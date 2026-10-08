// Mesaj okundu bilgisi (5.3-S2): public.room_reads tablosu (user_id, room_id, last_read_at).
// Eskiden auth user_metadata["last_read_<roomId>"] kullanılıyordu; her oda JWT/çereze bir anahtar ekliyordu.
// Web (istemci ve sunucu) ve mobil aynı tabloyu kullanır. RLS: kullanıcı yalnızca kendi satırını,
// yalnızca katıldığı odalar için okur/yazar. Zaman sunucu saatini geçemez (tetikleyici).

import type { SupabaseClient } from '@supabase/supabase-js'

// Kenar çubuğundaki okunmamış sayısının yenilenmesi için tarayıcı olayı (components/dashboard/useUnreadMessageCount.ts).
export const ROOM_READ_EVENT = 'influmatch:room-read'

const IN_BATCH = 100

export async function getLastReadMap(
  supabase: SupabaseClient,
  userId: string,
  roomIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = Array.from(new Set(roomIds.filter(Boolean)))
  for (let i = 0; i < unique.length; i += IN_BATCH) {
    const { data, error } = await supabase
      .from('room_reads')
      .select('room_id, last_read_at')
      .eq('user_id', userId)
      .in('room_id', unique.slice(i, i + IN_BATCH))
    if (error) {
      console.error('[room-reads] Okuma hatası:', error.message)
      continue
    }
    for (const row of data ?? []) map.set(row.room_id as string, row.last_read_at as string)
  }
  return map
}

export async function markRoomsRead(supabase: SupabaseClient, userId: string, roomIds: string[]): Promise<boolean> {
  const unique = Array.from(new Set(roomIds.filter(Boolean)))
  if (unique.length === 0) return true
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('room_reads')
    .upsert(
      unique.map((roomId) => ({ user_id: userId, room_id: roomId, last_read_at: now })),
      { onConflict: 'user_id,room_id' },
    )
  if (error) {
    console.error('[room-reads] Yazma hatası:', error.message)
    return false
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ROOM_READ_EVENT))
  }
  return true
}
