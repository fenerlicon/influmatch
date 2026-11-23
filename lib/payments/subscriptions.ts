// Abonelik kayıtları ve Spotlight'ın tek kaynaktan türetilmesi (2026-11-23).
//
// Spotlight durumu (users.spotlight_active / spotlight_plan / spotlight_expires_at) yalnızca syncUserSpotlight ile yazılır:
// kullanıcının bütün abonelik kayıtları (iyzico, App Store, Google Play, admin, 0₺ dönemi, görev ödülü) okunur, kural
// lib/payments/billing-shared.ts resolveEntitlement'ta. Hiç abonelik kaydı olmayan kullanıcıya dokunulmaz (eski elle açılmış
// üyelikler migration'da aktarıldı; tablo yoksa bütün eski yollar aynen çalışır).
//
// Tablolar (subscriptions, payments, payment_events) istemci rollerine yazmaya kapalı; burada service role kullanılır.
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncBlueTick } from '@/lib/blue-tick'
import { notifyUser } from '@/lib/notify'
import {
  livePaidSubscription,
  planMatchesRole,
  promoDiscountEligible,
  proPlanForRole,
  resolveEntitlement,
  type BillingRole,
  type Entitlement,
  type SpotlightPlanCode,
  type SubscriptionSource,
  type SubscriptionStatus,
} from '@/lib/payments/billing-shared'

export const SUBSCRIPTION_COLUMNS =
  'id, user_id, plan, billing_interval, source, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, past_due_since, grace_until, iyzico_subscription_ref, iyzico_customer_ref, iyzico_pricing_plan_ref, iyzico_checkout_token, apple_original_transaction_id, google_purchase_token, store_product_id, store_environment, discount_kind, discount_percent, discount_code, discount_reward_id, discount_state, pending_plan, renewal_reminder_for, expiry_notice_for, last_synced_at, note, created_by, created_at, updated_at'

export interface SubscriptionRow {
  id: string
  user_id: string
  plan: SpotlightPlanCode
  billing_interval: 'mo' | 'yr' | null
  source: SubscriptionSource
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  past_due_since: string | null
  grace_until: string | null
  iyzico_subscription_ref: string | null
  iyzico_customer_ref: string | null
  iyzico_pricing_plan_ref: string | null
  iyzico_checkout_token: string | null
  apple_original_transaction_id: string | null
  google_purchase_token: string | null
  store_product_id: string | null
  store_environment: string | null
  discount_kind: 'promo_first_period' | 'task_code' | null
  discount_percent: number | null
  discount_code: string | null
  discount_reward_id: string | null
  discount_state: 'scheduled' | 'active' | 'done' | null
  pending_plan: SpotlightPlanCode | null
  renewal_reminder_for: string | null
  expiry_notice_for: string | null
  last_synced_at: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export const PAYMENT_COLUMNS =
  'id, subscription_id, user_id, provider, provider_order_ref, provider_payment_id, plan, billing_interval, amount, currency, status, period_start, period_end, discount_percent, failure_reason, refunded_amount, refunded_at, refund_note, invoice_status, invoice_ref, created_at'

export interface PaymentRow {
  id: string
  subscription_id: string | null
  user_id: string
  provider: 'iyzico' | 'apple' | 'google'
  provider_order_ref: string
  provider_payment_id: string | null
  plan: SpotlightPlanCode | null
  billing_interval: 'mo' | 'yr' | null
  amount: number
  currency: string
  status: 'success' | 'failed' | 'refunded' | 'partially_refunded' | 'canceled'
  period_start: string | null
  period_end: string | null
  discount_percent: number | null
  failure_reason: string | null
  refunded_amount: number | null
  refunded_at: string | null
  refund_note: string | null
  invoice_status: 'pending' | 'issued' | 'failed' | 'not_applicable'
  invoice_ref: string | null
  created_at: string
}

export const BILLING_LINK = '/dashboard/billing'

export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message ?? '')
}

let readyCache: { at: number; ok: boolean } | null = null

/** Ödeme tabloları canlıda mı (SQL çalıştırılmadıysa ödeme arayüzü gizli kalır, hiçbir yer çökmez). 5 dk önbellek. */
export async function billingTablesReady(admin: SupabaseClient): Promise<boolean> {
  if (readyCache && Date.now() - readyCache.at < 5 * 60 * 1000) return readyCache.ok
  const { error } = await admin.from('subscriptions').select('id').limit(1)
  const ok = !error
  if (error && !isMissingTable(error)) console.error('[billing] tablo kontrolü:', error.message)
  readyCache = { at: Date.now(), ok }
  return ok
}

// ---------------------------------------------------------------------------
// Ayarlar (platform_settings; yalnızca service role)
// ---------------------------------------------------------------------------

export const BILLING_SETTING_KEYS = ['payments_enabled', 'iap_enabled', 'promo_ends_at', 'promo_discount_until'] as const
export type BillingSettingKey = (typeof BILLING_SETTING_KEYS)[number]

export interface BillingSettings {
  /** Web'de satış (iyzico). Yasal metinler + canlı anahtarlar gelene kadar KAPALI. */
  payments_enabled: boolean
  /** Mağaza içi satın alma (App Store / Google Play) sunucu doğrulaması. KAPALI. */
  iap_enabled: boolean
  /** 0₺ dönemi Spotlight'ının biteceği an (satış başlangıcı). */
  promo_ends_at: string | null
  /** İlk ay %50 hakkının son günü (null = süre sınırı yok; karar sahibinde). */
  promo_discount_until: string | null
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = { payments_enabled: false, iap_enabled: false, promo_ends_at: null, promo_discount_until: null }

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Okuma hatasında varsayılan (satış kapalı). */
export async function loadBillingSettings(admin: SupabaseClient): Promise<BillingSettings> {
  const { data, error } = await admin.from('platform_settings').select('key, value').in('key', [...BILLING_SETTING_KEYS])
  if (error) {
    console.error('[billing] ayarlar okunamadı:', error.message)
    return { ...DEFAULT_BILLING_SETTINGS }
  }
  const raw = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]))
  return {
    payments_enabled: raw.get('payments_enabled') === true,
    iap_enabled: raw.get('iap_enabled') === true,
    promo_ends_at: isoOrNull(raw.get('promo_ends_at')),
    promo_discount_until: isoOrNull(raw.get('promo_discount_until')),
  }
}

export async function saveBillingSetting(admin: SupabaseClient, adminUserId: string, key: BillingSettingKey, value: boolean | string | null) {
  const { error } = await admin
    .from('platform_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: adminUserId }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

export async function listUserSubscriptions(admin: SupabaseClient, userId: string): Promise<SubscriptionRow[] | null> {
  const { data, error } = await admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  if (error) {
    if (!isMissingTable(error)) console.error('[billing] abonelikler okunamadı:', error.message)
    return null
  }
  return (data ?? []) as SubscriptionRow[]
}

export async function getSubscription(admin: SupabaseClient, id: string): Promise<SubscriptionRow | null> {
  const { data } = await admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('id', id).maybeSingle()
  return (data as SubscriptionRow | null) ?? null
}

export async function listUserPayments(admin: SupabaseClient, userId: string, limit = 24): Promise<PaymentRow[]> {
  const { data, error } = await admin.from('payments').select(PAYMENT_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) return []
  return (data ?? []) as PaymentRow[]
}

export async function updateSubscription(admin: SupabaseClient, id: string, patch: Partial<SubscriptionRow>) {
  const { error } = await admin
    .from('subscriptions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Abonelik güncellenemedi: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Spotlight eşitleme (TEK KAYNAK)
// ---------------------------------------------------------------------------

export interface SpotlightSyncResult {
  skipped: boolean
  changed: boolean
  entitlement: Entitlement | null
}

/**
 * Kullanıcının Spotlight alanlarını abonelik kayıtlarından türetir. Kayıt yoksa (ya da tablo yoksa) dokunmaz.
 * Hesap onaylı değilse Spotlight açılmaz (saatlik görev onaysız hesapta zaten kapatıyor; çekişme olmasın).
 */
export async function syncUserSpotlight(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<SpotlightSyncResult> {
  const rows = await listUserSubscriptions(admin, userId)
  if (!rows || rows.length === 0) return { skipped: true, changed: false, entitlement: null }
  const { data: user } = await admin
    .from('users')
    .select('id, role, verification_status, spotlight_active, spotlight_plan, spotlight_expires_at')
    .eq('id', userId)
    .maybeSingle()
  if (!user) return { skipped: true, changed: false, entitlement: null }

  const entitlement = resolveEntitlement(rows, user.role as string, now)
  const active = !!entitlement && user.verification_status === 'verified'
  const next = active
    ? { spotlight_active: true, spotlight_plan: entitlement!.plan, spotlight_expires_at: entitlement!.expiresAt }
    : { spotlight_active: false, spotlight_plan: null, spotlight_expires_at: null }

  const sameExpiry =
    (next.spotlight_expires_at ?? null) === (user.spotlight_expires_at ?? null) ||
    (!!next.spotlight_expires_at && !!user.spotlight_expires_at && new Date(next.spotlight_expires_at).getTime() === new Date(user.spotlight_expires_at as string).getTime())
  const changed = !!user.spotlight_active !== next.spotlight_active || (user.spotlight_plan ?? null) !== next.spotlight_plan || !sameExpiry
  if (changed) {
    const { error } = await admin.from('users').update(next).eq('id', userId)
    if (error) throw new Error(`Spotlight eşitlenemedi: ${error.message}`)
    // Mavi tik Spotlight üyeliğine bağlı.
    if (!!user.spotlight_active !== next.spotlight_active || (user.spotlight_plan ?? null) !== next.spotlight_plan) await syncBlueTick(userId, admin)
  }
  return { skipped: false, changed, entitlement }
}

/** Hata fırlatmayan sürüm (bildirim/webhook akışında asıl işi bozmasın). */
export async function syncUserSpotlightSafe(admin: SupabaseClient, userId: string) {
  try {
    return await syncUserSpotlight(admin, userId)
  } catch (error) {
    console.error('[billing] Spotlight eşitlenemedi:', error instanceof Error ? error.message : error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Ücretsiz kaynaklar: admin tanımı, 0₺ dönemi, görev ödülü
// ---------------------------------------------------------------------------

export interface GrantInput {
  userId: string
  plan: SpotlightPlanCode
  source: Extract<SubscriptionSource, 'admin' | 'promo' | 'reward'>
  /** null = süresiz (yalnızca admin). */
  end: string | null
  start?: string
  note?: string | null
  createdBy?: string | null
}

/** Süreli/süresiz ücretsiz abonelik kaydı açar ve Spotlight'ı eşitler. Tablo yoksa { missingTable: true }. */
export async function grantSubscription(admin: SupabaseClient, input: GrantInput): Promise<{ ok: true; id: string } | { ok: false; missingTable?: boolean; error: string }> {
  const { data: user } = await admin.from('users').select('role').eq('id', input.userId).maybeSingle()
  if (!user) return { ok: false, error: 'Kullanıcı bulunamadı.' }
  if (!planMatchesRole(input.plan, user.role as string)) return { ok: false, error: 'Paket kullanıcının rolüne uymuyor.' }
  if (input.source !== 'admin' && !input.end) return { ok: false, error: 'Bitiş tarihi gerekli.' }
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('subscriptions')
    .insert({
      user_id: input.userId,
      plan: input.plan,
      source: input.source,
      status: 'active',
      current_period_start: input.start ?? now,
      current_period_end: input.end,
      note: input.note?.slice(0, 500) ?? null,
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single()
  if (error || !data) {
    if (isMissingTable(error)) return { ok: false, missingTable: true, error: 'Ödeme tabloları canlıda yok.' }
    return { ok: false, error: error?.message ?? 'Abonelik kaydedilemedi.' }
  }
  await syncUserSpotlight(admin, input.userId)
  return { ok: true, id: data.id as string }
}

/** Ücretsiz kaynaklı (admin / 0₺ / ödül) aktif kayıtları sona erdirir. Ücretli abonelik etkilenmez. */
export async function endFreeSubscriptions(
  admin: SupabaseClient,
  userId: string,
  sources: Array<Extract<SubscriptionSource, 'admin' | 'promo' | 'reward'>> = ['admin', 'promo', 'reward'],
): Promise<{ ok: boolean; missingTable?: boolean; ended: number }> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('subscriptions')
    .update({ status: 'expired', current_period_end: now, updated_at: now })
    .eq('user_id', userId)
    .in('source', sources)
    .in('status', ['active', 'past_due'])
    .select('id')
  if (error) return { ok: false, missingTable: isMissingTable(error), ended: 0 }
  await syncUserSpotlight(admin, userId)
  return { ok: true, ended: (data ?? []).length }
}

// ---------------------------------------------------------------------------
// İndirim hakları
// ---------------------------------------------------------------------------

/** İlk ay %50 hakkı (kural lib/payments/billing-shared.ts promoDiscountEligible). */
export function promoDiscountEligibleFromRows(rows: SubscriptionRow[], settings: BillingSettings, now: Date = new Date()): boolean {
  return promoDiscountEligible(rows, settings.promo_discount_until, now)
}

export interface UsableCode {
  rewardId: string
  code: string
  percent: number
  /** Kod daha önce düşmüş (expired) bir ödemeye ayrılmışsa o kaydın kimliği (yeniden ayırmada koşul). */
  reservedSubscriptionId: string | null
}

/** Kullanıcının kendi, kullanılabilir (satışta açılmış), kullanılmamış görev kodu. Başka aktif ödemeye ayrılmışsa null. */
export async function findUsableCode(admin: SupabaseClient, userId: string, code: string): Promise<UsableCode | null> {
  const { data, error } = await admin
    .from('task_rewards')
    .select('id, code, reward_percent, used_at, used_subscription_id, status, reward_type')
    .eq('code', code)
    .eq('user_id', userId)
    .eq('reward_type', 'discount_percent')
    .eq('status', 'applied')
    .maybeSingle()
  if (error || !data || data.used_at || !data.reward_percent) return null
  if (data.used_subscription_id) {
    const reserved = await getSubscription(admin, data.used_subscription_id as string)
    // Başka (yarım kalmamış) bir ödemeye ayrılmış kod kullanılamaz.
    if (reserved && reserved.status !== 'expired') return null
  }
  return { rewardId: data.id as string, code: data.code as string, percent: Number(data.reward_percent), reservedSubscriptionId: (data.used_subscription_id as string | null) ?? null }
}

/** Kullanıcının kullanılmamış kodları (ayarlar ekranında öneri). */
export async function listUsableCodes(admin: SupabaseClient, userId: string): Promise<UsableCode[]> {
  const { data, error } = await admin
    .from('task_rewards')
    .select('id, code, reward_percent, used_at')
    .eq('user_id', userId)
    .eq('reward_type', 'discount_percent')
    .eq('status', 'applied')
    .is('used_at', null)
    .limit(20)
  if (error) return []
  return (data ?? [])
    .filter((r) => r.code && r.reward_percent)
    .map((r) => ({ rewardId: r.id as string, code: r.code as string, percent: Number(r.reward_percent), reservedSubscriptionId: null }))
}

/** Kodu bir ödemeye ayırır (koşullu: kullanılmamış ve başka kayda ayrılmamış/ayrıldığı kayıt düşmüş). */
export async function reserveCode(admin: SupabaseClient, rewardId: string, subscriptionId: string, previousReservation: string | null): Promise<boolean> {
  let q = admin.from('task_rewards').update({ used_subscription_id: subscriptionId }).eq('id', rewardId).is('used_at', null)
  q = previousReservation ? q.eq('used_subscription_id', previousReservation) : q.is('used_subscription_id', null)
  const { data, error } = await q.select('id').maybeSingle()
  return !error && !!data
}

export async function markCodeUsed(admin: SupabaseClient, rewardId: string, subscriptionId: string) {
  await admin.from('task_rewards').update({ used_at: new Date().toISOString(), used_subscription_id: subscriptionId }).eq('id', rewardId).is('used_at', null)
}

export async function releaseCode(admin: SupabaseClient, rewardId: string | null, subscriptionId: string) {
  if (!rewardId) return
  await admin.from('task_rewards').update({ used_subscription_id: null }).eq('id', rewardId).eq('used_subscription_id', subscriptionId).is('used_at', null)
}

// ---------------------------------------------------------------------------
// Bildirim
// ---------------------------------------------------------------------------

export async function notifyBilling(admin: SupabaseClient, userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') {
  await notifyUser({ userId, event: 'billing', title, message, link: BILLING_LINK, type }, admin)
}

// ---------------------------------------------------------------------------
// Özet (web Ayarlar, Spotlight sayfaları, mobil durum ucu)
// ---------------------------------------------------------------------------

export interface BillingOverview {
  tablesReady: boolean
  settings: BillingSettings
  role: BillingRole | null
  verified: boolean
  subscriptions: SubscriptionRow[]
  livePaid: SubscriptionRow | null
  entitlement: Entitlement | null
  promoEligible: boolean
}

export async function getBillingOverview(admin: SupabaseClient, userId: string): Promise<BillingOverview> {
  const [settings, ready, { data: user }] = await Promise.all([
    loadBillingSettings(admin),
    billingTablesReady(admin),
    admin.from('users').select('role, verification_status').eq('id', userId).maybeSingle(),
  ])
  const role = user?.role === 'brand' || user?.role === 'influencer' ? (user.role as BillingRole) : null
  const rows = ready ? (await listUserSubscriptions(admin, userId)) ?? [] : []
  return {
    tablesReady: ready,
    settings,
    role,
    verified: user?.verification_status === 'verified',
    subscriptions: rows,
    livePaid: livePaidSubscription(rows),
    entitlement: resolveEntitlement(rows, role),
    promoEligible: promoDiscountEligibleFromRows(rows, settings),
  }
}

/** 0₺ dönemi Pro kaydı (kullanıcının rolüne göre). */
export function promoPlanFor(role: BillingRole): SpotlightPlanCode {
  return proPlanForRole(role)
}
