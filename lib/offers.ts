// Teklif işlemlerinin ortak çekirdeği. Web sunucu aksiyonları (çerez oturumu) ve mobil uçlar (Bearer token)
// aynı fonksiyonları kendi kullanıcı istemcileriyle çağırır; RLS her iki yolda da aynen uygulanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır. Çağıran taraf kullanıcıyı
// doğrulayıp onun istemcisini (supabase) ve kimliğini (userId) verir.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { hasVerifiedSocialAccount, SOCIAL_VERIFICATION_REQUIRED } from '@/lib/creator-verification'
import { createCollaborationFor } from '@/lib/collaborations'
import { OFFER_EXPIRY_DAYS, OFFER_EXPIRY_MS, effectiveOfferStatus } from '@/lib/offer-shared'
import { brandLimitErrorFromDb, getBrandLimitContext, getOfferQuota, offerQuotaError } from '@/lib/brand-limits'
import { canBrandViewInfluencer, getWheelState } from '@/lib/discovery-wheel'
import { closeOfferRoomOnWithdraw } from '@/lib/room-close'

export interface CreateOfferInput {
  receiverId: string
  campaignName: string
  campaignType?: string | null
  budget?: string | number | null
  message?: string | null
  paymentType?: 'cash' | 'barter' | null
  /** Kampanya daveti (3.19): markanın kendi taslak / aktif kampanyası. */
  campaignId?: string | null
}

/** Teklif oluşturma sonucu. code: 'quota' teklif hakkı doldu (toplu davet bu durumda durur). */
export type CreateOfferResult = { success: true; offerId: string | null } | { error: string; code?: 'quota' | 'campaign' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type OfferResponse = 'accepted' | 'rejected' | 'hold'

export interface OfferFields {
  campaignName: string
  campaignType: string | null
  budgetValue: number | null
  paymentType: 'cash' | 'barter'
  message: string | null
}

/** Teklif ve teklif şablonu alanlarının ortak doğrulaması. */
export function validateOfferFields(input: Omit<CreateOfferInput, 'receiverId'>): OfferFields | { error: string } {
  const campaignName = input.campaignName?.toString().trim() ?? ''
  if (!campaignName || campaignName.length > 120) {
    return { error: 'Kampanya adı 1-120 karakter olmalı.' }
  }

  const campaignType = input.campaignType?.toString().trim() || null
  if (campaignType && campaignType.length > 40) return { error: 'Kampanya tipi en fazla 40 karakter olabilir.' }

  const paymentType = input.paymentType === 'barter' ? 'barter' : 'cash'
  const rawBudget = input.budget === null || input.budget === undefined ? '' : String(input.budget).trim()
  const budgetValue = rawBudget ? Number(rawBudget) : null
  if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0 || budgetValue > 100_000_000)) {
    return { error: 'Bütçe geçerli bir tutar olmalı.' }
  }

  const message = input.message?.toString().trim() || null
  if (message && message.length > 2000) {
    return { error: 'Mesaj en fazla 2000 karakter olabilir.' }
  }
  return { campaignName, campaignType, budgetValue, paymentType, message }
}

export async function createOfferAs(
  supabase: SupabaseClient,
  userId: string,
  input: CreateOfferInput,
): Promise<CreateOfferResult> {
  if ((await fetchAccountRole(supabase, userId)) !== 'brand') {
    return { error: 'Sadece marka hesapları teklif gönderebilir.' }
  }

  const { data: profile } = await supabase.from('users').select('verification_status').eq('id', userId).maybeSingle()
  if (profile?.verification_status !== 'verified') {
    return { error: 'Hesabınız henüz onaylanmadı. Teklif gönderebilmek için hesabınızın onaylanması gerekmektedir.' }
  }

  if (!input.receiverId || (await fetchAccountRole(supabase, input.receiverId)) !== 'influencer') {
    return { error: 'Teklif yalnızca influencer/UGC hesaplarına gönderilebilir.' }
  }

  const fields = validateOfferFields(input)
  if ('error' in fields) return { error: fields.error }
  const { campaignName, campaignType, budgetValue, paymentType, message } = fields

  // Kampanya bağlantısı: yalnızca markanın kendi taslak / aktif kampanyası (RLS'li oturum istemcisi yalnızca kendi
  // kampanyalarını döndürür; DB'de enforce_campaign_owner tetikleyicisi de yedek kontrol yapar).
  let campaignId: string | null = null
  if (input.campaignId) {
    if (typeof input.campaignId !== 'string' || !UUID_RE.test(input.campaignId)) return { error: 'Kampanya bulunamadı.', code: 'campaign' }
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, brand_id, status')
      .eq('id', input.campaignId)
      .eq('brand_id', userId)
      .maybeSingle()
    if (!campaign) return { error: 'Kampanya bulunamadı.', code: 'campaign' }
    if (campaign.status !== 'draft' && campaign.status !== 'active') {
      return { error: 'Tamamlanan ya da arşivlenen kampanyaya davet gönderilemez.', code: 'campaign' }
    }
    campaignId = campaign.id as string
  }

  // Ücretsiz marka teklif sınırı (bayrak kapalıyken kota null döner, kontrol yapılmaz). Sayım okunamazsa
  // DB tetikleyicisi (enforce_brand_offer_limits) yedek olarak sınırı yine uygular.
  // Keşif çarkı açıkken ücretsiz marka yalnızca açabildiği profillere (çark / önceki ilişki) teklif gönderir.
  try {
    const limitContext = await getBrandLimitContext(userId)
    if (limitContext.active) {
      const wheel = await getWheelState(userId, limitContext)
      if (wheel.limited && !(await canBrandViewInfluencer(userId, input.receiverId, wheel))) {
        return { error: 'Bu profil şu anki keşif çarkında değil. Teklifi çarktaki profillere ya da daha önce çalıştığın profillere gönderebilirsin.' }
      }
    }
    const quotaError = offerQuotaError(await getOfferQuota(userId, limitContext))
    if (quotaError) return { error: quotaError, code: 'quota' }
  } catch (quotaReadError) {
    console.error('[createOffer] quota read error:', quotaReadError)
  }

  const { data: inserted, error } = await supabase
    .from('offers')
    .insert({
      sender_user_id: userId,
      receiver_user_id: input.receiverId,
      campaign_name: campaignName,
      campaign_type: campaignType,
      budget: budgetValue,
      payment_type: paymentType,
      message,
      status: 'pending',
      ...(campaignId ? { campaign_id: campaignId } : {}),
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[createOffer] insert error:', error)
    const limitError = brandLimitErrorFromDb(error.message)
    if (limitError) return { error: limitError, code: 'quota' }
    if (error.message?.includes('campaign_owner_mismatch')) return { error: 'Kampanya bulunamadı.', code: 'campaign' }
    return { error: 'Teklif gönderilemedi. Lütfen tekrar deneyin.' }
  }

  const admin = createSupabaseAdminClient()
  const brandName = await displayNameOf(admin, userId)
  await notifyUser(
    {
      userId: input.receiverId,
      event: 'offer_new',
      title: 'Yeni teklif aldınız',
      message: `${brandName} size "${campaignName}" kampanyası için teklif gönderdi.`,
      link: '/dashboard/works?stage=offers',
    },
    admin,
  )

  return { success: true, offerId: (inserted?.id as string | undefined) ?? null }
}

const sameInstant = (a: string | null | undefined, b: string | null | undefined) =>
  (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null)

const OFFER_EDITED_SINCE_SEEN = 'Marka bu teklifi az önce düzenledi. Yeni koşulları inceleyip tekrar deneyin.'

/**
 * Influencer teklife yanıt verir. 'hold' = "Markayla görüş": durum değişmez, pazarlık için teklif odası açılır.
 * seenEditedAt verilirse (ekrandaki teklifin edited_at değeri) ve marka o arada teklifi düzenlediyse kabul
 * reddedilir: influencer eski koşulları görerek kabul etmesin.
 */
export async function respondToOfferAs(
  supabase: SupabaseClient,
  userId: string,
  offerId: string,
  response: OfferResponse,
  options: { seenEditedAt?: string | null } = {},
): Promise<{ error: string } | { success: true; roomId: string | null; senderUserId: string }> {
  if (!['accepted', 'rejected', 'hold'].includes(response)) {
    return { error: 'Geçersiz teklif durumu.' }
  }

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id, receiver_user_id, sender_user_id, status, campaign_name, created_at, edited_at')
    .eq('id', offerId)
    .maybeSingle()

  if (offerError || !offer) return { error: 'Teklif bulunamadı.' }
  if (offer.receiver_user_id !== userId) return { error: 'Bu teklif üzerinde işlem yapma yetkiniz yok.' }
  if (offer.status === 'withdrawn') return { error: 'Marka bu teklifi geri çekti.' }
  // Saatlik görev henüz işaretlemediyse de 7 günü geçen teklif yanıtlanamaz.
  if (effectiveOfferStatus(offer as { status: string; created_at: string }) === 'expired') {
    return { error: `Bu teklifin süresi doldu (${OFFER_EXPIRY_DAYS} gün içinde yanıtlanmadı).` }
  }
  if (offer.status !== 'pending') return { error: 'Bu teklif zaten yanıtlanmış.' }
  if (response === 'accepted' && options.seenEditedAt !== undefined && !sameInstant(options.seenEditedAt, offer.edited_at as string | null)) {
    return { error: OFFER_EDITED_SINCE_SEEN }
  }
  if (response !== 'rejected' && !(await hasVerifiedSocialAccount(supabase, userId))) {
    return { error: SOCIAL_VERIFICATION_REQUIRED }
  }

  if (response !== 'hold') {
    // Yalnızca hâlâ bekleyen teklif güncellenir (aynı anda süresi dolarsa kabul edilmez).
    const { data: updatedRows, error: updateError } = await supabase
      .from('offers')
      .update({ status: response })
      .eq('id', offerId)
      .eq('status', 'pending')
      .select('id, status')
    if (updateError) {
      console.error('[respondToOffer] update error:', updateError)
      return { error: 'Teklif güncellenemedi. Lütfen tekrar deneyin.' }
    }
    if (!updatedRows?.length || updatedRows[0].status !== response) {
      return { error: 'Bu teklif artık yanıtlanamaz.' }
    }
  }

  let roomId: string | null = null
  if (response === 'accepted' || response === 'hold') {
    const { data: existingRoom, error: roomError } = await supabase.from('rooms').select('id').eq('offer_id', offerId).maybeSingle()
    if (roomError) {
      console.error('[respondToOffer] room read error:', roomError)
      return { error: 'Sohbet açılamadı. Lütfen tekrar deneyin.' }
    }
    if (existingRoom?.id) {
      roomId = existingRoom.id
    } else {
      const { data: newRoom, error: insertRoomError } = await supabase
        .from('rooms')
        .insert({ offer_id: offerId, brand_id: offer.sender_user_id, influencer_id: offer.receiver_user_id })
        .select('id')
        .single()
      if (insertRoomError) {
        console.error('[respondToOffer] room insert error:', insertRoomError)
        return { error: 'Sohbet açılamadı. Lütfen tekrar deneyin.' }
      }
      roomId = newRoom?.id ?? null
    }
  }

  const admin = createSupabaseAdminClient()

  // Kabul edilen teklif ortak iş birliği akışına geçer (lib/collaborations.ts).
  if (response === 'accepted') {
    await createCollaborationFor(
      {
        source: 'offer',
        sourceId: offerId,
        brandId: offer.sender_user_id as string,
        influencerId: offer.receiver_user_id as string,
        title: offer.campaign_name as string | null,
        roomId,
      },
      admin,
    )
  }

  const influencerName = await displayNameOf(admin, userId)
  const campaign = offer.campaign_name ? `"${offer.campaign_name}"` : 'teklifiniz'
  await notifyUser(
    response === 'hold'
      ? {
          userId: offer.sender_user_id,
          event: 'offer_talk',
          title: 'Influencer görüşmek istiyor',
          message: `${influencerName}, ${campaign} için sizinle görüşmek istiyor. Sohbet açıldı.`,
          link: roomId ? `/dashboard/messages?roomId=${roomId}` : '/dashboard/works?stage=offers',
        }
      : {
          userId: offer.sender_user_id,
          event: 'offer_response',
          title: response === 'accepted' ? 'Teklifiniz kabul edildi' : 'Teklifiniz reddedildi',
          message:
            response === 'accepted'
              ? `${influencerName}, ${campaign} teklifini kabul etti. Sohbetten ve İşler sayfasından devam edebilirsiniz.`
              : `${influencerName}, ${campaign} teklifini reddetti.`,
          link: response === 'accepted' && roomId ? `/dashboard/messages?roomId=${roomId}` : '/dashboard/works?stage=offers',
          type: response === 'accepted' ? 'success' : 'info',
        },
    admin,
  )

  return { success: true, roomId, senderUserId: offer.sender_user_id as string }
}

interface BrandPendingOffer {
  id: string
  sender_user_id: string
  receiver_user_id: string
  campaign_name: string | null
  campaign_type: string | null
  budget: number | string | null
  payment_type: string | null
  message: string | null
  status: string
  created_at: string
}

/** Marka yalnızca kendi gönderdiği, hâlâ bekleyen (süresi dolmamış) teklifi değiştirebilir. */
async function loadBrandPendingOffer(
  supabase: SupabaseClient,
  userId: string,
  offerId: string,
  verb: string,
): Promise<{ error: string } | { offer: BrandPendingOffer }> {
  if (!offerId || typeof offerId !== 'string') return { error: 'Teklif bulunamadı.' }
  if ((await fetchAccountRole(supabase, userId)) !== 'brand') return { error: 'Bu işlem yalnızca marka hesapları içindir.' }

  // Oturum istemcisiyle okunur: RLS markaya yalnızca kendi gönderdiği teklifleri gösterir.
  const { data, error } = await supabase
    .from('offers')
    .select('id, sender_user_id, receiver_user_id, campaign_name, campaign_type, budget, payment_type, message, status, created_at')
    .eq('id', offerId)
    .maybeSingle()
  const offer = data as BrandPendingOffer | null
  if (error || !offer) return { error: 'Teklif bulunamadı.' }
  if (offer.sender_user_id !== userId) return { error: 'Bu teklif üzerinde işlem yapma yetkiniz yok.' }

  const status = effectiveOfferStatus(offer)
  if (status === 'expired') return { error: `Bu teklifin süresi doldu; ${verb}.` }
  if (status === 'withdrawn') return { error: 'Bu teklif zaten geri çekildi.' }
  if (status !== 'pending') return { error: `Influencer bu teklifi yanıtladı; artık ${verb}.` }
  return { offer }
}

/** Güncelleme yalnızca hâlâ bekleyen ve süresi dolmamış satıra yazılır (aynı anda yanıt / süre dolumu yarışı). */
function updatePendingOffer(admin: SupabaseClient, offerId: string, userId: string, patch: Record<string, unknown>) {
  return admin
    .from('offers')
    .update(patch)
    .eq('id', offerId)
    .eq('sender_user_id', userId)
    .eq('status', 'pending')
    .gt('created_at', new Date(Date.now() - OFFER_EXPIRY_MS).toISOString())
    .select('id')
}

/**
 * Marka bekleyen teklifini geri çeker (2026-10-14). Kabul / red / süresi dolmuş teklif geri çekilemez.
 * Geri çekilen teklif kotadan düşmez (sayım durumdan bağımsız, created_at ile). Influencer'a site içi + push bildirim.
 * Teklifin sohbet odası varsa kapanır (salt okunur, lib/room-close.ts).
 */
export async function withdrawOfferAs(
  supabase: SupabaseClient,
  userId: string,
  offerId: string,
): Promise<{ success: true } | { error: string }> {
  const check = await loadBrandPendingOffer(supabase, userId, offerId, 'geri çekilemez')
  if ('error' in check) return check
  const { offer } = check

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik.' }
  const { data: updated, error } = await updatePendingOffer(admin, offer.id, userId, {
    status: 'withdrawn',
    withdrawn_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[withdrawOffer] update error:', error.message)
    return { error: 'Teklif geri çekilemedi. Lütfen tekrar deneyin.' }
  }
  if (!updated?.length) return { error: 'Bu teklif artık geri çekilemez (yanıtlanmış ya da süresi dolmuş olabilir).' }

  // "Markayla görüş" ile açılmış oda kapanır, sistem mesajı yazılır (3.6-S8).
  await closeOfferRoomOnWithdraw(admin, offer.id, userId)

  const brandName = await displayNameOf(admin, userId)
  const campaign = offer.campaign_name ? `"${offer.campaign_name}" teklifini` : 'teklifini'
  await notifyUser(
    {
      userId: offer.receiver_user_id,
      event: 'offer_withdrawn',
      title: 'Marka teklifi geri çekti',
      message: `${brandName}, ${campaign} geri çekti. Bu teklif artık yanıtlanamaz.`,
      link: '/dashboard/works?stage=offers',
    },
    admin,
  )
  return { success: true }
}

/**
 * Marka bekleyen teklifini düzenler (2026-10-14). 7 günlük süre yeniden başlamaz (created_at değişmez),
 * kotaya yeni teklif olarak sayılmaz; edited_at yazılır ve influencer'a site içi + push bildirim gider.
 */
export async function editOfferAs(
  supabase: SupabaseClient,
  userId: string,
  offerId: string,
  input: Omit<CreateOfferInput, 'receiverId'>,
): Promise<{ success: true; changed: boolean } | { error: string }> {
  if (!input || typeof input !== 'object') return { error: 'Geçersiz istek.' }
  const fields = validateOfferFields(input)
  if ('error' in fields) return { error: fields.error }

  const check = await loadBrandPendingOffer(supabase, userId, offerId, 'düzenlenemez')
  if ('error' in check) return check
  const { offer } = check

  const unchanged =
    offer.campaign_name === fields.campaignName &&
    (offer.campaign_type ?? null) === fields.campaignType &&
    (offer.budget === null ? null : Number(offer.budget)) === fields.budgetValue &&
    (offer.payment_type === 'barter' ? 'barter' : 'cash') === fields.paymentType &&
    (offer.message ?? null) === fields.message
  if (unchanged) return { success: true, changed: false }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik.' }
  const { data: updated, error } = await updatePendingOffer(admin, offer.id, userId, {
    campaign_name: fields.campaignName,
    campaign_type: fields.campaignType,
    budget: fields.budgetValue,
    payment_type: fields.paymentType,
    message: fields.message,
    edited_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[editOffer] update error:', error.message)
    return { error: 'Teklif güncellenemedi. Lütfen tekrar deneyin.' }
  }
  if (!updated?.length) return { error: 'Bu teklif artık düzenlenemez (yanıtlanmış ya da süresi dolmuş olabilir).' }

  const brandName = await displayNameOf(admin, userId)
  await notifyUser(
    {
      userId: offer.receiver_user_id,
      event: 'offer_edited',
      title: 'Teklif güncellendi',
      message: `${brandName}, "${fields.campaignName}" teklifini düzenledi. Yanıtlamadan önce yeni koşulları inceleyin.`,
      link: '/dashboard/works?stage=offers',
    },
    admin,
  )
  return { success: true, changed: true }
}

/**
 * Saatlik görev: OFFER_EXPIRY_DAYS gün yanıtlanmayan teklifler "expired" olur, markaya bildirim gider.
 * Çok eski teklifler (bu özellik açılmadan önce bekleyenler) bildirimsiz kapatılır.
 */
export async function expireStaleOffers(admin: SupabaseClient, options: { limit?: number; deadline?: number } = {}) {
  const cutoff = new Date(Date.now() - OFFER_EXPIRY_MS).toISOString()
  const notifyAfter = new Date(Date.now() - 2 * OFFER_EXPIRY_MS).toISOString()
  const { data, error } = await admin
    .from('offers')
    .select('id, sender_user_id, receiver_user_id, campaign_name, created_at')
    .eq('status', 'pending')
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(options.limit ?? 50)
  if (error) throw new Error(error.message)

  let expired = 0
  let notified = 0
  for (const row of data ?? []) {
    if (options.deadline && Date.now() > options.deadline) break
    const { data: updated, error: updateError } = await admin
      .from('offers')
      .update({ status: 'expired' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
    if (updateError || !updated?.length) continue
    expired++
    if ((row.created_at as string) < notifyAfter) continue

    const influencerName = await displayNameOf(admin, row.receiver_user_id as string)
    const campaign = row.campaign_name ? `"${row.campaign_name}"` : 'Teklifiniz'
    await notifyUser(
      {
        userId: row.sender_user_id as string,
        event: 'offer_expired',
        title: 'Teklifin süresi doldu',
        message: `${influencerName}, ${campaign} teklifini ${OFFER_EXPIRY_DAYS} gün içinde yanıtlamadı; teklifin süresi doldu. Başka bir influencer'a gönderebilirsiniz.`,
        link: '/dashboard/works?stage=offers',
      },
      admin,
    )
    notified++
  }
  return { due: data?.length ?? 0, expired, notified }
}
