// 0₺ dönemi (2026-10-18 kararı): bayrak public.platform_settings 'promo_period_enabled' (yalnızca service role; admin /admin/tasks).
// Bayrak açıkken herkes Spotlight Pro'dadır; mavi tik için ek şart: onaylanmış tanıtım videosu görevi + en az 1 tamamlanan iş birliği,
// güven skorunda Spotlight puanı sayılmaz (lib/blue-tick-rules.ts). Bayrak kapalıyken davranış bugünküyle aynıdır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlueTickPromo } from '@/lib/blue-tick-rules'

export const PROMO_PERIOD_KEY = 'promo_period_enabled'

/** Okuma hatasında kapalı sayılır (bugünkü davranış). */
export async function loadPromoPeriod(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin.from('platform_settings').select('value').eq('key', PROMO_PERIOD_KEY).maybeSingle()
  if (error) {
    console.error('[tasks-promo] bayrak okunamadı:', error.message)
    return false
  }
  return data?.value === true
}

export async function savePromoPeriod(admin: SupabaseClient, adminUserId: string, enabled: boolean) {
  const { error } = await admin
    .from('platform_settings')
    .upsert({ key: PROMO_PERIOD_KEY, value: enabled, updated_at: new Date().toISOString(), updated_by: adminUserId }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

/**
 * Mavi tik değerlendirmesi için kullanıcı başına 0₺ dönemi bilgisi. Bayrak kapalıysa null (ek şart yok).
 * Okuma hatasında şart sağlanmamış sayılır (tik verilmez; mevcut tikler saatlik görevde yeniden değerlendirilir).
 */
export async function loadBlueTickPromo(admin: SupabaseClient, userIds: string[]): Promise<Map<string, BlueTickPromo> | null> {
  if (!(await loadPromoPeriod(admin))) return null
  const out = new Map<string, BlueTickPromo>()
  for (const id of userIds) out.set(id, { enabled: true, promoTaskDone: false, completedCollabs: 0 })
  if (!userIds.length) return out

  const { data: promoTasks } = await admin.from('platform_tasks').select('id').eq('kind', 'promo_video')
  const taskIds = ((promoTasks ?? []) as Array<{ id: string }>).map((t) => t.id)

  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const [approved, collabs] = await Promise.all([
      taskIds.length
        ? admin.from('task_submissions').select('user_id').in('task_id', taskIds).in('user_id', chunk).eq('status', 'approved')
        : Promise.resolve({ data: [], error: null }),
      admin.from('collaborations').select('influencer_id').in('influencer_id', chunk).eq('status', 'completed').limit(5000),
    ])
    if (approved.error) console.error('[tasks-promo] görevler okunamadı:', approved.error.message)
    if (collabs.error) console.error('[tasks-promo] iş birlikleri okunamadı:', collabs.error.message)
    for (const row of (approved.data ?? []) as Array<{ user_id: string }>) {
      const entry = out.get(row.user_id)
      if (entry) entry.promoTaskDone = true
    }
    for (const row of (collabs.data ?? []) as Array<{ influencer_id: string }>) {
      const entry = out.get(row.influencer_id)
      if (entry) entry.completedCollabs++
    }
  }
  return out
}
