// Profil görüntülenme istatistikleri (profile_views). Tablo istemcilere kapalıdır; sayılar sunucuda
// service role ile okunur ve yalnızca Spotlight üyesi profil sahibine gönderilir (kullanıcı kararı, 2026-10-08).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProfileViewStats {
  last7: number
  last30: number
  brandViewers30: number
  daily: { date: string; count: number }[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const TZ = 'Europe/Istanbul'

function istanbulDate(date: Date): string {
  // en-CA biçimi YYYY-MM-DD verir
  return date.toLocaleDateString('en-CA', { timeZone: TZ })
}

export async function getProfileViewStats(admin: SupabaseClient, profileId: string): Promise<ProfileViewStats | null> {
  const now = new Date()
  const since30 = istanbulDate(new Date(now.getTime() - 29 * DAY_MS))
  const since7 = istanbulDate(new Date(now.getTime() - 6 * DAY_MS))

  const { data, error } = await admin
    .from('profile_views')
    .select('viewer_id, viewer_role, viewed_on')
    .eq('profile_id', profileId)
    .gte('viewed_on', since30)
    .limit(10000)

  if (error) {
    console.error('[profile-views] okunamadı:', error.message)
    return null
  }

  const rows = data ?? []
  const byDay = new Map<string, number>()
  const brandViewers = new Set<string>()
  let last7 = 0
  for (const row of rows) {
    const day = row.viewed_on as string
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
    if (day >= since7) last7++
    if (row.viewer_role === 'brand') brandViewers.add(row.viewer_id as string)
  }

  const daily: { date: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const date = istanbulDate(new Date(now.getTime() - i * DAY_MS))
    daily.push({ date, count: byDay.get(date) ?? 0 })
  }

  return { last7, last30: rows.length, brandViewers30: brandViewers.size, daily }
}
