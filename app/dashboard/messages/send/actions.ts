'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { sendMessageAs } from '@/lib/messages'

export async function sendMessage(roomId: string, content: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }

  const result = await sendMessageAs(supabase, user.id, roomId, content)
  if (!result.success) return result

  // Gönderen için oda okundu sayılır (okunmamış sayısı metadata'dan hesaplanır, lib/unread-messages.ts).
  try {
    await supabase.auth.updateUser({ data: { [`last_read_${roomId}`]: new Date().toISOString() } })
  } catch (error) {
    console.warn('[sendMessage] last_read güncellenemedi:', error)
  }

  revalidatePath('/dashboard/messages')
  return result
}
