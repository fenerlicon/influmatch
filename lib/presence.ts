// Çevrimiçi durumu ve son görülme. Kaynak: user_activity.last_seen_at (oturum açık sekmeler dakikada bir
// touch_last_seen çağırır) ve sinyal hiç gelmemişse auth.users.last_sign_in_at.
//
// loadLastSeen BU DOSYADA 'use server' OLMADAN tutulur: yalnızca admin kontrolü yapılmış sunucu kodu çağırır.

import type { SupabaseClient } from '@supabase/supabase-js'

/** Son sinyalden bu kadar süre geçmediyse kullanıcı çevrimiçi sayılır (sinyal aralığı 60 sn). */
export const ONLINE_WINDOW_MS = 150_000

export function isOnline(lastSeenAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!lastSeenAt) return false
  return now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS
}

export function formatLastSeen(lastSeenAt: string | null | undefined, now: number = Date.now()): string {
  if (!lastSeenAt) return 'Hiç görülmedi'
  const time = new Date(lastSeenAt).getTime()
  const diff = now - time
  if (diff < ONLINE_WINDOW_MS) return 'Çevrimiçi'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} sa önce`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} gün önce`
  return new Date(time).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Istanbul' })
}

/** Kullanıcı id → son görülme (ISO). Admin istemcisi (service role) gerekir. */
export async function loadLastSeen(admin: SupabaseClient): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const keepLatest = (id: string, iso: string | null | undefined) => {
    if (!iso) return
    if (!result[id] || new Date(iso).getTime() > new Date(result[id]).getTime()) result[id] = iso
  }

  const { data: activity, error } = await admin.from('user_activity').select('user_id, last_seen_at').limit(10000)
  if (error) console.error('[presence] user_activity okunamadı:', error.message)
  for (const row of activity ?? []) keepLatest(row.user_id as string, row.last_seen_at as string)

  // Sinyal sistemi öncesi kullanıcılar için son giriş zamanı
  for (let page = 1; page <= 20; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (listError) {
      console.error('[presence] auth kullanıcıları okunamadı:', listError.message)
      break
    }
    for (const user of data.users) keepLatest(user.id, user.last_sign_in_at)
    if (data.users.length < 1000) break
  }

  return result
}
