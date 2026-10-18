'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { sendMessageAs } from '@/lib/messages'
import { markRoomsRead } from '@/lib/room-reads'

export async function sendMessage(roomId: string, content: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }

  const result = await sendMessageAs(supabase, user.id, roomId, content)
  if (!result.success) return result

  // Gönderen için oda okundu sayılır (room_reads, lib/room-reads.ts).
  // revalidatePath yok (2026-10-19): sohbet istemcide anında güncellenir (iyimser gönderim + Realtime); sayfayı her
  // mesajda sunucuda baştan üretmek gönderimi yavaşlatıyordu.
  await markRoomsRead(supabase, user.id, [roomId])
  return result
}
