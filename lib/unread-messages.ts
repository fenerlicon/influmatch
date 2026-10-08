// Okunmamış mesaj sayısı (istemci). Okundu kaynağı public.room_reads tablosudur (lib/room-reads.ts).

import type { SupabaseClient } from '@supabase/supabase-js'
import { getLastReadMap } from '@/lib/room-reads'

export async function countUnreadInRoom(supabase: SupabaseClient, roomId: string, userId: string): Promise<number> {
  const lastRead = (await getLastReadMap(supabase, userId, [roomId])).get(roomId)

  let query = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .neq('sender_id', userId)
  if (lastRead) query = query.gt('created_at', lastRead)

  const { count, error } = await query
  if (error) {
    console.error('[unread-messages] Sayım hatası:', error.message)
    return 0
  }
  return count ?? 0
}
