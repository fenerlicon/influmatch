'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'hold'

export async function updateOfferStatus(offerId: string, nextStatus: OfferStatus) {
  if (!['accepted', 'rejected', 'hold'].includes(nextStatus)) {
    throw new Error('Geçersiz teklif durumu')
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturumunuz bulunamadı')
  }

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id, receiver_user_id, sender_user_id, status')
    .eq('id', offerId)
    .single()

  if (offerError || !offer) {
    throw new Error('Teklif bulunamadı')
  }

  if (offer.receiver_user_id !== user.id) {
    throw new Error('Bu teklif üzerinde işlem yapma yetkiniz yok')
  }

  if (offer.status !== 'pending') {
    throw new Error('Sadece bekleyen teklifler güncellenebilir')
  }

  // Only update DB status if not 'hold'
  if (nextStatus !== 'hold') {
    const { error: updateError } = await supabase.from('offers').update({ status: nextStatus }).eq('id', offerId)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  let roomId: string | null = null

  // Create room if accepted or held
  if (nextStatus === 'accepted' || nextStatus === 'hold') {
    const { data: existingRoom, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('offer_id', offerId)
      .maybeSingle()

    if (roomError) {
      throw new Error(roomError.message)
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
          // If 'hold', we might want to distinguish the room logic? No, standard room is fine.
        })
        .select('id')
        .single()

      if (insertRoomError) {
        throw new Error(insertRoomError.message)
      }
      roomId = newRoom?.id ?? null
    }
  }

  revalidatePath('/dashboard/influencer/offers')
  revalidatePath('/dashboard/offers')
  return { success: true, roomId, senderUserId: offer.sender_user_id }
}

