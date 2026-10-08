'use server'

import { revalidatePath } from 'next/cache'
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
  await markRoomsRead(supabase, user.id, [roomId])

  revalidatePath('/dashboard/messages')
  return result
}
