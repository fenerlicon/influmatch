'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'

type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'hold'

// 'hold' = "Markayla görüş": durum değişmez, pazarlık için teklif odası açılır.
export async function updateOfferStatus(
  offerId: string,
  nextStatus: OfferStatus,
): Promise<{ error: string } | { success: true; roomId: string | null; senderUserId: string }> {
  if (!['accepted', 'rejected', 'hold'].includes(nextStatus)) {
    return { error: 'Geçersiz teklif durumu.' }
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturumunuz bulunamadı.' }
  }

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id, receiver_user_id, sender_user_id, status, campaign_name')
    .eq('id', offerId)
    .single()

  if (offerError || !offer) {
    return { error: 'Teklif bulunamadı.' }
  }

  if (offer.receiver_user_id !== user.id) {
    return { error: 'Bu teklif üzerinde işlem yapma yetkiniz yok.' }
  }

  if (offer.status !== 'pending') {
    return { error: 'Bu teklif zaten yanıtlanmış.' }
  }

  // 'hold' durumu kaydedilmez; teklif beklemede kalır.
  if (nextStatus !== 'hold') {
    const { error: updateError } = await supabase.from('offers').update({ status: nextStatus }).eq('id', offerId)
    if (updateError) {
      console.error('[updateOfferStatus] update error:', updateError)
      return { error: 'Teklif güncellenemedi. Lütfen tekrar deneyin.' }
    }
  }

  let roomId: string | null = null

  // Kabul ve görüşmede teklif odası açılır (varsa yeniden kullanılır).
  if (nextStatus === 'accepted' || nextStatus === 'hold') {
    const { data: existingRoom, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('offer_id', offerId)
      .maybeSingle()

    if (roomError) {
      console.error('[updateOfferStatus] room read error:', roomError)
      return { error: 'Sohbet açılamadı. Lütfen tekrar deneyin.' }
    }

    if (existingRoom?.id) {
      roomId = existingRoom.id
    } else {
      const { data: newRoom, error: insertRoomError } = await supabase
        .from('rooms')
        .insert({
          offer_id: offerId,
          brand_id: offer.sender_user_id,
          influencer_id: offer.receiver_user_id,
        })
        .select('id')
        .single()

      if (insertRoomError) {
        console.error('[updateOfferStatus] room insert error:', insertRoomError)
        return { error: 'Sohbet açılamadı. Lütfen tekrar deneyin.' }
      }
      roomId = newRoom?.id ?? null
    }
  }

  const admin = createSupabaseAdminClient()
  const influencerName = await displayNameOf(admin, user.id)
  const campaign = offer.campaign_name ? `"${offer.campaign_name}"` : 'teklifiniz'
  await notifyUser(
    nextStatus === 'hold'
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
          title: nextStatus === 'accepted' ? 'Teklifiniz kabul edildi' : 'Teklifiniz reddedildi',
          message:
            nextStatus === 'accepted'
              ? `${influencerName}, ${campaign} teklifini kabul etti. Sohbetten devam edebilirsiniz.`
              : `${influencerName}, ${campaign} teklifini reddetti.`,
          link: nextStatus === 'accepted' && roomId ? `/dashboard/messages?roomId=${roomId}` : '/dashboard/brand/offers',
          type: nextStatus === 'accepted' ? 'success' : 'info',
        },
    admin,
  )

  revalidatePath('/dashboard/influencer/offers')
  revalidatePath('/dashboard/offers')
  return { success: true as const, roomId, senderUserId: offer.sender_user_id as string }
}

