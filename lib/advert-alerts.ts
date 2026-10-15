// Kaydedilen ilanlar ve ilan alarmları (yol haritası, 2026-10-10).
// - Influencer ilanı kaydeder ("Kaydedilenler" sekmesi), en fazla SAVED_ADVERT_LIMIT ilan.
// - Influencer en fazla ADVERT_ALERT_LIMIT alarm kurar (kategori, anahtar kelime, platform, en az bütçe). Yeni açılan ilan
//   bir alarma uyarsa bildirim gider (site içi + e-posta tercihine göre + push):
//   * Spotlight Basic/Pro influencer: ilan yayınlanır yayınlanmaz (anlık ilan alarmı, 3.15-S1; `dispatchInstantAdvertAlerts`).
//   * Diğerleri: saatlik görev (`processAdvertAlerts`).
//   Kime gönderildiği `advert_alert_deliveries` (ilan + kullanıcı tekil) tablosunda: aynı ilan için kimseye iki kez gitmez,
//   süre bütçesine sığmayan alıcılar bir sonraki saatte tamamlanır (3.15-S3).
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
import { resolveSubscriptionTier } from '@/lib/subscription-tier'
import { ADVERT_GENERAL_CATEGORY, isAdvertCategoryKey } from '@/utils/categories'
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
  /** Anahtar kelime. */
  category?: unknown
  /** Influencer kategori anahtarı. */
  categoryKey?: unknown
  platform?: unknown
  minBudget?: unknown
}

const ROLE_ERROR = 'Bu özellik yalnızca influencer/UGC hesaplarına açık.'
const ALERT_COLUMNS = 'id, category, category_key, platform, min_budget, created_at'

/** Anlık ilan alarmı hakkı: onaylı influencer + aktif Spotlight (Basic ya da Pro). */
export function hasInstantAdvertAlerts(row: Parameters<typeof resolveSubscriptionTier>[0]): boolean {
  if (row?.role !== 'influencer') return false
  const tier = resolveSubscriptionTier(row)
  return tier === 'SPOTLIGHT' || tier === 'SPOTLIGHT_PLUS'
}

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

/** Alarmlar + `instant`: alarmlar yayın anında mı (Spotlight) yoksa saatlik mi çalışıyor. */
export async function listAdvertAlertsAs(supabase: SupabaseClient, userId: string): Promise<Result<{ alerts: AdvertAlert[]; instant: boolean }>> {
  const [{ data: me }, { data, error }] = await Promise.all([
    supabase.from('users').select('role, verification_status, spotlight_active, spotlight_plan, spotlight_expires_at').eq('id', userId).maybeSingle(),
    supabase.from('advert_alerts').select(ALERT_COLUMNS).eq('user_id', userId).order('created_at', { ascending: true }).limit(ADVERT_ALERT_LIMIT),
  ])
  if (me?.role !== 'influencer') return { error: ROLE_ERROR }
  if (error) {
    console.error('[advert-alerts] list error', error.message)
    return { error: 'Alarmlar yüklenemedi.' }
  }
  return { success: true, alerts: (data ?? []) as AdvertAlert[], instant: hasInstantAdvertAlerts(me) }
}

export function validateAdvertAlertInput(input: AdvertAlertInput): Result<{ row: AdvertAlertRule }> {
  const category = typeof input.category === 'string' ? input.category.trim() : ''
  if (category.length > 60) return { error: 'Anahtar kelime en fazla 60 karakter olabilir.' }

  const categoryKey = typeof input.categoryKey === 'string' ? input.categoryKey.trim() : ''
  if (categoryKey && (!isAdvertCategoryKey(categoryKey) || categoryKey === ADVERT_GENERAL_CATEGORY)) return { error: 'Kategori listeden seçilmeli.' }

  const platform = typeof input.platform === 'string' ? input.platform.trim().toLowerCase() : ''
  if (platform && !ADVERT_ALERT_PLATFORMS.some((p) => p.key === platform)) return { error: 'Geçersiz platform.' }

  let minBudget: number | null = null
  if (input.minBudget !== null && input.minBudget !== undefined && input.minBudget !== '') {
    const cleaned = typeof input.minBudget === 'string' ? input.minBudget.replace(/[\s.₺]/g, '') : input.minBudget
    const n = Number(cleaned)
    if (!Number.isInteger(n) || n < 1 || n > 100_000_000) return { error: 'En az bütçe 1 ile 100.000.000 arasında tam sayı olmalı.' }
    minBudget = n
  }
  return { success: true, row: { category: category || null, category_key: categoryKey || null, platform: platform || null, min_budget: minBudget } }
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
    .select(ALERT_COLUMNS)
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
// Eşleştirme ve gönderim (anlık + saatlik)

/** Bu süreden eski ilanlar için alarm gönderilmez (özellik açılmadan önceki ilanlar ve gecikmeler). */
const ALERT_WINDOW_MS = 48 * 60 * 60 * 1000
const NOTIFY_BATCH = 10
/** Anlık gönderimin süre bütçesi (yayın isteğinin arka planı; kalan alıcıları saatlik görev tamamlar). */
const INSTANT_BUDGET_MS = 8_000
const ADVERT_COLUMNS = 'id, title, category, platforms, budget_min, budget_max, brand_user_id, brand_name, status, created_at'

type AlertAdvertRow = {
  id: string
  title: string | null
  category: string | null
  platforms: string[] | null
  budget_min: number | string | null
  budget_max: number | string | null
  brand_user_id: string | null
  brand_name: string | null
  status?: string | null
}
type AlertRow = AdvertAlertRule & { user_id: string }

async function loadAllAlerts(admin: SupabaseClient): Promise<AlertRow[]> {
  const { data, error } = await admin.from('advert_alerts').select('user_id, category, category_key, platform, min_budget').limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []) as AlertRow[]
}

/** İlana uyan alarm sahipleri (ilanın sahibi hariç, kullanıcı başına bir kez). */
function matchingRecipients(advert: AlertAdvertRow, alerts: AlertRow[]): string[] {
  const recipients = new Set<string>()
  for (const alert of alerts) {
    const uid = alert.user_id
    if (uid === advert.brand_user_id || recipients.has(uid)) continue
    if (advertMatchesAlert(advert, alert)) recipients.add(uid)
  }
  return Array.from(recipients)
}

/** Daha önce bu ilan için alarm gönderilmiş kullanıcılar. */
async function deliveredTo(admin: SupabaseClient, advertId: string): Promise<Set<string>> {
  const { data, error } = await admin.from('advert_alert_deliveries').select('user_id').eq('advert_id', advertId).limit(10000)
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((r) => r.user_id as string))
}

/**
 * Alıcılara 10'arlı gruplar hâlinde bildirim gönderir. Her grup önce `advert_alert_deliveries`'e yazılır (ilan + kullanıcı
 * tekil); yalnızca bu çağrının yazabildiği satırlar bildirilir, böylece anlık gönderim ile saatlik görev ya da iki koşu
 * aynı kişiye iki kez göndermez. Süre dolunca durur; gönderilmeyenler kayıtsız kalır ve sonra tamamlanır.
 */
async function deliverAdvertAlert(
  admin: SupabaseClient,
  advert: AlertAdvertRow,
  userIds: string[],
  channel: 'instant' | 'hourly',
  deadline?: number,
): Promise<{ sent: number; finished: boolean }> {
  const brand = advert.brand_name?.trim()
  const title = advert.title?.trim() || 'Yeni ilan'
  let sent = 0
  for (let i = 0; i < userIds.length; i += NOTIFY_BATCH) {
    if (deadline && Date.now() > deadline) return { sent, finished: false }
    const batch = userIds.slice(i, i + NOTIFY_BATCH)
    const { data: claimed, error } = await admin
      .from('advert_alert_deliveries')
      .upsert(
        batch.map((user_id) => ({ advert_id: advert.id, user_id, channel })),
        { onConflict: 'advert_id,user_id', ignoreDuplicates: true },
      )
      .select('user_id')
    if (error) {
      console.error('[advert-alerts] delivery claim error', error.message)
      return { sent, finished: false }
    }
    await Promise.all(
      (claimed ?? []).map((row) =>
        notifyUser(
          {
            userId: row.user_id as string,
            event: 'advert_alert',
            title: 'Alarmına uygun yeni ilan',
            message: `${brand ? `${brand}: ` : ''}"${title}" ilanı yayında. Kurduğun ilan alarmına uyuyor.`,
            link: '/dashboard/influencer/advert',
          },
          admin,
        ),
      ),
    )
    sent += claimed?.length ?? 0
  }
  return { sent, finished: true }
}

/**
 * Anlık ilan alarmı (Spotlight Basic/Pro influencer, 3.15-S1): ilan yayınlanınca çağrılır (arka planda, süre bütçesiyle).
 * Yalnızca alarmı uyan ve aktif Spotlight'ı olan onaylı influencer'lara gönderir; geri kalanını (ve süreye sığmayanları)
 * saatlik görev tamamlar.
 */
export async function dispatchInstantAdvertAlerts(advertId: string): Promise<{ sent: number }> {
  const deadline = Date.now() + INSTANT_BUDGET_MS
  const admin = createSupabaseAdminClient()
  if (!admin) return { sent: 0 }
  const { data: advert, error } = await admin.from('advert_projects').select(ADVERT_COLUMNS).eq('id', advertId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!advert || advert.status !== 'open') return { sent: 0 }

  const candidates = matchingRecipients(advert as AlertAdvertRow, await loadAllAlerts(admin))
  if (!candidates.length) return { sent: 0 }

  const eligible: string[] = []
  for (let i = 0; i < candidates.length; i += 200) {
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('id, role, verification_status, spotlight_active, spotlight_plan, spotlight_expires_at')
      .in('id', candidates.slice(i, i + 200))
    if (usersError) throw new Error(usersError.message)
    for (const u of users ?? []) if (hasInstantAdvertAlerts(u)) eligible.push(u.id as string)
  }
  if (!eligible.length) return { sent: 0 }

  const already = await deliveredTo(admin, advertId)
  const todo = eligible.filter((id) => !already.has(id))
  const { sent } = await deliverAdvertAlert(admin, advert as AlertAdvertRow, todo, 'instant', deadline)
  return { sent }
}

/**
 * Saatlik görev: son 48 saatte açılan ve tamamlanmamış ilanları alarmlarla eşleştirir. Daha önce (anlık ya da önceki
 * saatte) gönderilenler atlanır; süre bütçesi biterse ilan "tamamlanmadı" kalır ve kalanlar sonraki saatte gönderilir
 * (3.15-S3). `advert_alert_runs` ilan başına özet (eşleşen, bildirilen, tamamlanma zamanı).
 */
export async function processAdvertAlerts(admin: SupabaseClient, options: { limit?: number; deadline?: number } = {}) {
  const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString()
  const { data: adverts, error } = await admin
    .from('advert_projects')
    .select(ADVERT_COLUMNS)
    .eq('status', 'open')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw new Error(error.message)
  if (!adverts?.length) return { adverts: 0, notified: 0 }

  const { data: runs, error: runsError } = await admin
    .from('advert_alert_runs')
    .select('advert_id, completed_at')
    .in('advert_id', adverts.map((a) => a.id as string))
  if (runsError) throw new Error(runsError.message)
  const done = new Set((runs ?? []).filter((r) => r.completed_at).map((r) => r.advert_id as string))
  const pending = (adverts as AlertAdvertRow[]).filter((a) => !done.has(a.id)).slice(0, options.limit ?? 10)
  if (!pending.length) return { adverts: 0, notified: 0 }

  const alerts = await loadAllAlerts(admin)

  let processed = 0
  let notified = 0
  for (const advert of pending) {
    if (options.deadline && Date.now() > options.deadline) break
    processed++

    const recipients = matchingRecipients(advert, alerts)
    const already = await deliveredTo(admin, advert.id)
    const todo = recipients.filter((id) => !already.has(id))
    const { sent, finished } = await deliverAdvertAlert(admin, advert, todo, 'hourly', options.deadline)
    notified += sent

    const now = new Date().toISOString()
    const { error: runError } = await admin
      .from('advert_alert_runs')
      .upsert(
        { advert_id: advert.id, processed_at: now, matched: recipients.length, notified: already.size + sent, completed_at: finished ? now : null },
        { onConflict: 'advert_id' },
      )
    if (runError) console.error('[advert-alerts] run update error', runError.message)
  }
  return { adverts: processed, notified }
}
