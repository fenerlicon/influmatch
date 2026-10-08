// Teklif işlemlerinin ortak çekirdeği. Web sunucu aksiyonları (çerez oturumu) ve mobil uçlar (Bearer token)
// aynı fonksiyonları kendi kullanıcı istemcileriyle çağırır; RLS her iki yolda da aynen uygulanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır. Çağıran taraf kullanıcıyı
// doğrulayıp onun istemcisini (supabase) ve kimliğini (userId) verir.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'
import { displayNameOf, notifyUser } from '@/lib/notify'

export interface CreateOfferInput {
  receiverId: string
  campaignName: string
  campaignType?: string | null
  budget?: string | number | null
  message?: string | null
  paymentType?: 'cash' | 'barter' | null
}

export type OfferResponse = 'accepted' | 'rejected' | 'hold'

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

  const campaignName = input.campaignName?.trim() ?? ''
  if (!campaignName || campaignName.length > 120) {
    return { error: 'Kampanya adı 1-120 karakter olmalı.' }
  }

  const paymentType = input.paymentType === 'barter' ? 'barter' : 'cash'
  const rawBudget = input.budget === null || input.budget === undefined ? '' : String(input.budget).trim()
  const budgetValue = rawBudget ? Number(rawBudget) : null
  if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0 || budgetValue > 100_000_000)) {
    return { error: 'Bütçe geçerli bir tutar olmalı.' }
  }

  const message = input.message?.trim() || null
  if (message && message.length > 2000) {
    return { error: 'Mesaj en fazla 2000 karakter olabilir.' }
  }

  const { error } = await supabase.from('offers').insert({
    sender_user_id: userId,
    receiver_user_id: input.receiverId,
    campaign_name: campaignName,
    campaign_type: input.campaignType?.trim() || null,
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
    .select('id, receiver_user_id, sender_user_id, status, campaign_name')
    .eq('id', offerId)
    .maybeSingle()

  if (offerError || !offer) return { error: 'Teklif bulunamadı.' }
  if (offer.receiver_user_id !== userId) return { error: 'Bu teklif üzerinde işlem yapma yetkiniz yok.' }
  if (offer.status !== 'pending') return { error: 'Bu teklif zaten yanıtlanmış.' }

  if (response !== 'hold') {
    const { error: updateError } = await supabase.from('offers').update({ status: response }).eq('id', offerId)
    if (updateError) {
      console.error('[respondToOffer] update error:', updateError)
      return { error: 'Teklif güncellenemedi. Lütfen tekrar deneyin.' }
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
              ? `${influencerName}, ${campaign} teklifini kabul etti. Sohbetten devam edebilirsiniz.`
              : `${influencerName}, ${campaign} teklifini reddetti.`,
          link: response === 'accepted' && roomId ? `/dashboard/messages?roomId=${roomId}` : '/dashboard/brand/offers',
          type: response === 'accepted' ? 'success' : 'info',
        },
    admin,
  )

  return { success: true, roomId, senderUserId: offer.sender_user_id as string }
}
