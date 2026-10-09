// Kaydedilen ilanlar ve ilan alarmları (yol haritası, 2026-10-10).
// - Influencer ilanı kaydeder ("Kaydedilenler" sekmesi), en fazla SAVED_ADVERT_LIMIT ilan.
// - Influencer en fazla ADVERT_ALERT_LIMIT alarm kurar (kategori kelimesi, platform, en az bütçe). Yeni açılan ilan
//   bir alarma uyarsa saatlik görev bildirim gönderir (site içi + e-posta tercihine göre + push).
//
// Tablolar `saved_adverts` ve `advert_alerts` istemcilere yalnızca okunur (RLS: yalnızca sahibi); yazımlar burada,
// rol kontrolünden sonra service role ile. `advert_alert_runs` yalnızca sunucuya açık (hangi ilan işlendi).
// Web sunucu aksiyonları ve mobil uçlar (/api/mobile/saved-adverts, /api/mobile/advert-alerts) aynı fonksiyonları çağırır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'
import { notifyUser } from '@/lib/notify'
import {
  ADVERT_ALERT_LIMIT,
  ADVERT_ALERT_PLATFORMS,
  SAVED_ADVERT_LIMIT,
  advertMatchesAlert,
  type AdvertAlertRule,
} from '@/lib/advert-alerts-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

export interface AdvertAlert extends AdvertAlertRule {
  id: string
  created_at: string
}

export interface AdvertAlertInput {
  category?: unknown
  platform?: unknown
  minBudget?: unknown
}

const ROLE_ERROR = 'Bu özellik yalnızca influencer/UGC hesaplarına açık.'

async function isInfluencer(supabase: SupabaseClient, userId: string) {
  return (await fetchAccountRole(supabase, userId)) === 'influencer'
}

// ---------------------------------------------------------------------------------------------
// Kaydedilen ilanlar

/** Kullanıcının kaydettiği ilan kimlikleri (en yeni önce). */
export async function listSavedAdvertIdsAs(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_adverts')
    .select('advert_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(SAVED_ADVERT_LIMIT)
  if (error) {
    console.error('[saved-adverts] list error', error.message)
    return []
  }
  return (data ?? []).map((r) => r.advert_id as string)
}

export async function setAdvertSavedAs(
  supabase: SupabaseClient,
  userId: string,
  advertId: string,
  saved: boolean,
): Promise<Result<{ saved: boolean }>> {
  if (!advertId || !/^[0-9a-f-]{36}$/i.test(advertId)) return { error: 'İlan bulunamadı.' }
  if (!(await isInfluencer(supabase, userId))) return { error: ROLE_ERROR }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }

  if (!saved) {
    const { error } = await admin.from('saved_adverts').delete().eq('user_id', userId).eq('advert_id', advertId)
    if (error) {
      console.error('[saved-adverts] delete error', error.message)
      return { error: 'İlan kayıtlardan çıkarılamadı.' }
    }
    return { success: true, saved: false }
  }

  // Yalnızca kullanıcının görebildiği (açık) ilan kaydedilir; kontrol kullanıcının kendi istemcisiyle (RLS).
  const { data: advert } = await supabase.from('advert_projects').select('id, status').eq('id', advertId).maybeSingle()
  if (!advert || advert.status !== 'open') return { error: 'Bu ilan artık yayında değil.' }

  const { count } = await admin.from('saved_adverts').select('advert_id', { count: 'exact', head: true }).eq('user_id', userId)
  if ((count ?? 0) >= SAVED_ADVERT_LIMIT) return { error: `En fazla ${SAVED_ADVERT_LIMIT} ilan kaydedebilirsiniz.` }

  const { error } = await admin
    .from('saved_adverts')
    .upsert({ user_id: userId, advert_id: advertId }, { onConflict: 'user_id,advert_id', ignoreDuplicates: true })
  if (error) {
    console.error('[saved-adverts] insert error', error.message)
    return { error: 'İlan kaydedilemedi.' }
  }
  return { success: true, saved: true }
}

// ---------------------------------------------------------------------------------------------
// İlan alarmları

export async function listAdvertAlertsAs(supabase: SupabaseClient, userId: string): Promise<Result<{ alerts: AdvertAlert[] }>> {
  if (!(await isInfluencer(supabase, userId))) return { error: ROLE_ERROR }
  const { data, error } = await supabase
    .from('advert_alerts')
    .select('id, category, platform, min_budget, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(ADVERT_ALERT_LIMIT)
  if (error) {
    console.error('[advert-alerts] list error', error.message)
    return { error: 'Alarmlar yüklenemedi.' }
  }
  return { success: true, alerts: (data ?? []) as AdvertAlert[] }
}

export function validateAdvertAlertInput(input: AdvertAlertInput): Result<{ row: AdvertAlertRule }> {
  const category = typeof input.category === 'string' ? input.category.trim() : ''
  if (category.length > 60) return { error: 'Kategori / anahtar kelime en fazla 60 karakter olabilir.' }

  const platform = typeof input.platform === 'string' ? input.platform.trim().toLowerCase() : ''
  if (platform && !ADVERT_ALERT_PLATFORMS.some((p) => p.key === platform)) return { error: 'Geçersiz platform.' }

  let minBudget: number | null = null
  if (input.minBudget !== null && input.minBudget !== undefined && input.minBudget !== '') {
    const cleaned = typeof input.minBudget === 'string' ? input.minBudget.replace(/[\s.₺]/g, '') : input.minBudget
    const n = Number(cleaned)
    if (!Number.isInteger(n) || n < 1 || n > 100_000_000) return { error: 'En az bütçe 1 ile 100.000.000 arasında tam sayı olmalı.' }
    minBudget = n
  }
  return { success: true, row: { category: category || null, platform: platform || null, min_budget: minBudget } }
}

export async function createAdvertAlertAs(supabase: SupabaseClient, userId: string, input: AdvertAlertInput): Promise<Result<{ alert: AdvertAlert }>> {
  if (!(await isInfluencer(supabase, userId))) return { error: ROLE_ERROR }
  const validated = validateAdvertAlertInput(input)
  if (!validated.success) return { error: validated.error }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }
  const { count, error: countError } = await admin.from('advert_alerts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (countError) return { error: 'Alarm kaydedilemedi.' }
  if ((count ?? 0) >= ADVERT_ALERT_LIMIT) return { error: `En fazla ${ADVERT_ALERT_LIMIT} ilan alarmı kurabilirsiniz.` }

  const { data, error } = await admin
    .from('advert_alerts')
    .insert({ user_id: userId, ...validated.row })
    .select('id, category, platform, min_budget, created_at')
    .single()
  if (error || !data) {
    console.error('[advert-alerts] insert error', error?.message)
    return { error: 'Alarm kaydedilemedi.' }
  }
  return { success: true, alert: data as AdvertAlert }
}

export async function deleteAdvertAlertAs(supabase: SupabaseClient, userId: string, alertId: string): Promise<Result> {
  if (!(await isInfluencer(supabase, userId))) return { error: ROLE_ERROR }
  if (!alertId || !/^[0-9a-f-]{36}$/i.test(alertId)) return { error: 'Alarm bulunamadı.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }
  const { data, error } = await admin.from('advert_alerts').delete().eq('id', alertId).eq('user_id', userId).select('id')
  if (error) {
    console.error('[advert-alerts] delete error', error.message)
    return { error: 'Alarm silinemedi.' }
  }
  if (!data?.length) return { error: 'Alarm bulunamadı.' }
  return { success: true }
}

// ---------------------------------------------------------------------------------------------
// Saatlik görev: yeni ilanları alarmlarla eşleştir

/** Bu süreden eski ilanlar için alarm gönderilmez (özellik açılmadan önceki ilanlar ve gecikmeler). */
const ALERT_WINDOW_MS = 48 * 60 * 60 * 1000
const MAX_RECIPIENTS_PER_ADVERT = 300
const NOTIFY_BATCH = 10

/**
 * Son 48 saatte açılan, henüz işlenmemiş ilanları alarmlarla eşleştirir. Her ilan bir kez işlenir
 * (`advert_alert_runs` satırı önce yazılır; aynı anda iki koşu aynı ilanı işlemez). Kullanıcı başına ilan başına
 * tek bildirim; ilanın sahibi bildirim almaz.
 */
export async function processAdvertAlerts(admin: SupabaseClient, options: { limit?: number; deadline?: number } = {}) {
  const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString()
  const { data: adverts, error } = await admin
    .from('advert_projects')
    .select('id, title, category, platforms, budget_min, budget_max, brand_user_id, brand_name')
    .eq('status', 'open')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw new Error(error.message)
  if (!adverts?.length) return { adverts: 0, notified: 0 }

  const { data: runs, error: runsError } = await admin
    .from('advert_alert_runs')
    .select('advert_id')
    .in('advert_id', adverts.map((a) => a.id as string))
  if (runsError) throw new Error(runsError.message)
  const done = new Set((runs ?? []).map((r) => r.advert_id as string))
  const pending = adverts.filter((a) => !done.has(a.id as string)).slice(0, options.limit ?? 10)
  if (!pending.length) return { adverts: 0, notified: 0 }

  const { data: alerts, error: alertsError } = await admin
    .from('advert_alerts')
    .select('user_id, category, platform, min_budget')
    .limit(5000)
  if (alertsError) throw new Error(alertsError.message)

  let processed = 0
  let notified = 0
  for (const advert of pending) {
    if (options.deadline && Date.now() > options.deadline) break

    // İlanı sahiplen: satır zaten varsa başka bir koşu işlemiş demektir.
    const { data: claimed, error: claimError } = await admin
      .from('advert_alert_runs')
      .upsert({ advert_id: advert.id }, { onConflict: 'advert_id', ignoreDuplicates: true })
      .select('advert_id')
    if (claimError || !claimed?.length) continue
    processed++

    const recipients = new Set<string>()
    for (const alert of alerts ?? []) {
      if (recipients.size >= MAX_RECIPIENTS_PER_ADVERT) break
      const uid = alert.user_id as string
      if (uid === advert.brand_user_id || recipients.has(uid)) continue
      if (advertMatchesAlert(advert as never, alert as AdvertAlertRule)) recipients.add(uid)
    }

    const list = Array.from(recipients)
    const brand = (advert.brand_name as string | null)?.trim()
    const title = (advert.title as string | null)?.trim() || 'Yeni ilan'
    let sent = 0
    for (let i = 0; i < list.length; i += NOTIFY_BATCH) {
      if (options.deadline && Date.now() > options.deadline + 10_000) break
      await Promise.all(
        list.slice(i, i + NOTIFY_BATCH).map((userId) =>
          notifyUser(
            {
              userId,
              event: 'advert_alert',
              title: 'Alarmına uygun yeni ilan',
              message: `${brand ? `${brand}: ` : ''}"${title}" ilanı yayında. Kurduğun ilan alarmına uyuyor.`,
              link: '/dashboard/influencer/advert',
            },
            admin,
          ),
        ),
      )
      sent += Math.min(NOTIFY_BATCH, list.length - i)
    }
    notified += sent
    await admin.from('advert_alert_runs').update({ matched: list.length, notified: sent }).eq('advert_id', advert.id)
  }
  return { adverts: processed, notified }
}
