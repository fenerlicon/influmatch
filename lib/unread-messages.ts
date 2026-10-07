// Okunmamış mesaj sayısı (istemci). Tek okundu kaynağı, mesaj kutusunun yazdığı
// auth user_metadata["last_read_<roomId>"] zamanıdır (components/messages/MessagesPage.tsx).
// Eski message_reads tablosu canlı veritabanında yok; ona dayanan sayılar hep 0 çıkıyordu.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function countUnreadInRoom(supabase: SupabaseClient, roomId: string, userId: string): Promise<number> {
  // getSession yerel oturumu okur (ağ isteği yok); mesaj kutusu updateUser ile aynı oturumu günceller.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const lastRead = session?.user?.user_metadata?.[`last_read_${roomId}`] as string | undefined

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
