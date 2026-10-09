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

export interface CreateOfferInput {
  receiverId: string
  campaignName: string
  campaignType?: string | null
  budget?: string | number | null
  message?: string | null
  paymentType?: 'cash' | 'barter' | null
}

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
): Promise<{ success: true } | { error: string }> {
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

  const { error } = await supabase.from('offers').insert({
    sender_user_id: userId,
    receiver_user_id: input.receiverId,
    campaign_name: campaignName,
    campaign_type: campaignType,
    budget: budgetValue,
    payment_type: paymentType,
    message,
    status: 'pending',
  })

  if (error) {
    console.error('[createOffer] insert error:', error)
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
      link: '/dashboard/offers',
    },
    admin,
  )

  return { success: true }
}

/**
 * Influencer teklife yanıt verir. 'hold' = "Markayla görüş": durum değişmez, pazarlık için teklif odası açılır.
 */
export async function respondToOfferAs(
  supabase: SupabaseClient,
  userId: string,
  offerId: string,
  response: OfferResponse,
): Promise<{ error: string } | { success: true; roomId: string | null; senderUserId: string }> {
  if (!['accepted', 'rejected', 'hold'].includes(response)) {
    return { error: 'Geçersiz teklif durumu.' }
  }

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id, receiver_user_id, sender_user_id, status, campaign_name, created_at')
    .eq('id', offerId)
    .maybeSingle()

  if (offerError || !offer) return { error: 'Teklif bulunamadı.' }
  if (offer.receiver_user_id !== userId) return { error: 'Bu teklif üzerinde işlem yapma yetkiniz yok.' }
  // Saatlik görev henüz işaretlemediyse de 7 günü geçen teklif yanıtlanamaz.
  if (effectiveOfferStatus(offer as { status: string; created_at: string }) === 'expired') {
    return { error: `Bu teklifin süresi doldu (${OFFER_EXPIRY_DAYS} gün içinde yanıtlanmadı).` }
  }
  if (offer.status !== 'pending') return { error: 'Bu teklif zaten yanıtlanmış.' }
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
          link: roomId ? `/dashboard/messages?roomId=${roomId}` : '/dashboard/brand/offers',
        }
      : {
          userId: offer.sender_user_id,
          event: 'offer_response',
          title: response === 'accepted' ? 'Teklifiniz kabul edildi' : 'Teklifiniz reddedildi',
          message:
            response === 'accepted'
              ? `${influencerName}, ${campaign} teklifini kabul etti. Sohbetten ve İş Birlikleri sayfasından devam edebilirsiniz.`
              : `${influencerName}, ${campaign} teklifini reddetti.`,
          link: response === 'accepted' && roomId ? `/dashboard/messages?roomId=${roomId}` : '/dashboard/brand/offers',
          type: response === 'accepted' ? 'success' : 'info',
        },
    admin,
  )

  return { success: true, roomId, senderUserId: offer.sender_user_id as string }
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
        link: '/dashboard/brand/offers',
      },
      admin,
    )
    notified++
  }
  return { due: data?.length ?? 0, expired, notified }
}
