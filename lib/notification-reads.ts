// Bildirimleri okundu işaretleme: web (app/actions/notifications.ts) ve mobil (/api/mobile/notifications)
// aynı kodu kullanır. Kullanıcı yalnızca kendi bildirimlerine dokunabilir (IDOR koruması + RLS).

import type { SupabaseClient } from '@supabase/supabase-js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** ids verilmezse kullanıcının tüm okunmamış bildirimleri işaretlenir. */
export async function markNotificationsReadAs(
  supabase: SupabaseClient,
  userId: string,
  ids?: string[],
): Promise<{ success: boolean; error?: string }> {
  let query = supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
  if (ids !== undefined) {
    const clean = Array.from(new Set(ids.filter((id) => typeof id === 'string' && UUID.test(id)))).slice(0, 200)
    if (clean.length === 0) return { success: true }
    query = query.in('id', clean)
  } else {
    query = query.eq('is_read', false)
  }

  const { error } = await query
  if (error) {
    console.error('Error marking notifications as read:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
