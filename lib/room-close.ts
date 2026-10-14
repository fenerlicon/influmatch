// Teklif odasının kapatılması (3.6-S8, 2026-10-14). Marka teklifini geri çekince o teklif için açılmış
// sohbet ("Markayla görüş") salt okunur olur: geçmiş görünür, iki taraf da yeni mesaj yazamaz.
// Yalnızca sunucudan, service role istemcisiyle çağrılır. DB yedeği: kapalı odaya istemciden mesaj eklenemez
// (`enforce_room_open_on_message`, migration 20261014000050).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'

export type RoomClosedReason = 'offer_withdrawn'

/** Kapalı oda için arayüzde gösterilen açıklama (web + mobil aynı metin). */
export const ROOM_CLOSED_TEXT: Record<RoomClosedReason, string> = {
  offer_withdrawn: 'Marka teklifini geri çekti.',
}

/**
 * Geri çekilen teklifin açık odasını kapatır ve odaya sistem mesajı yazar. Oda yoksa bir şey yapmaz.
 * Hata teklif geri çekmeyi bozmaz (yalnızca kaydedilir); DB tetikleyicisi yeni oda açılmasını zaten engeller.
 */
export async function closeOfferRoomOnWithdraw(admin: SupabaseClient, offerId: string, brandId: string) {
  const { data: rooms, error } = await admin
    .from('rooms')
    .update({ closed_at: new Date().toISOString(), closed_reason: 'offer_withdrawn' })
    .eq('offer_id', offerId)
    .is('closed_at', null)
    .select('id')
  if (error) {
    console.error('[closeOfferRoom] room update error:', error.message)
    return
  }
  if (!rooms?.length) return

  const { error: messageError } = await admin.from('messages').insert(
    rooms.map((room) => ({
      room_id: room.id,
      sender_id: brandId,
      content: ROOM_CLOSED_TEXT.offer_withdrawn,
      is_system: true,
    })),
  )
  if (messageError) console.error('[closeOfferRoom] system message error:', messageError.message)
}
