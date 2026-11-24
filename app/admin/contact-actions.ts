'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { adminViewContact } from '@/lib/user-contact'

/** Admin: kullanıcının telefon numarası (yalnızca admin; her görüntüleme hassas erişim günlüğüne yazılır). */
export async function getUserPhone(userId: string): Promise<{ phone: string | null; marketingSms: boolean } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) return { error: 'Kullanıcı bulunamadı.' }
  const result = await adminViewContact(user.id, userId)
  return result.success ? { phone: result.phone, marketingSms: result.marketingSms } : { error: result.error }
}
