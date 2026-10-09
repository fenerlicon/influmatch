// Ücretsiz marka sınırları (yol haritası adım 3, 2026-10-10 kararı): teklif (gün / takvim ayı) ve aktif ilan sınırı.
// Değerler public.platform_settings'ten (lib/platform-settings.ts) okunur. Bayrak kapalıyken (varsayılan) hiçbir
// sınır uygulanmaz ve davranış bugünküyle aynıdır. Aynı kural DB'de brand_limit_for() + BEFORE tetikleyicileriyle
// yedeklenir (migration 20261010000020); ikisi birlikte değiştirilmelidir.
//
// Plan: aktif Spotlight + mpro = 'pro' (sınırsız), diğer aktif Spotlight = 'basic', yoksa 'free'. Influencer sınırlanmaz.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { hasActiveSpotlight, type SpotlightFields } from '@/lib/spotlight-access'
import { isProPlan } from '@/lib/subscription-tier'
import { loadPlatformSettings, type PlatformSettings } from '@/lib/platform-settings'

export type BrandPlan = 'free' | 'basic' | 'pro'

export function brandPlanOf(row: (SpotlightFields & { spotlight_plan?: string | null }) | null | undefined): BrandPlan {
  if (!row || !hasActiveSpotlight(row)) return 'free'
  return isProPlan(row.spotlight_plan) ? 'pro' : 'basic'
}

export interface BrandLimits {
  offersPerDay: number | null
  offersPerMonth: number | null
  activeAdverts: number | null
}

export interface BrandLimitContext {
  /** Bayrak açık ve kullanıcı marka mı? false ise hiçbir sınır yok. */
  active: boolean
  plan: BrandPlan
  settings: PlatformSettings
  limits: BrandLimits
  /** Keşif çarkı yalnızca ücretsiz markada (Spotlight markalar herkesi görür). */
  wheel: boolean
}

const NO_LIMITS: BrandLimits = { offersPerDay: null, offersPerMonth: null, activeAdverts: null }

/** Sınır bağlamı. Ayar ya da kullanıcı okunamazsa sınır uygulanmaz (bugünkü davranış). */
export async function getBrandLimitContext(userId: string, admin?: SupabaseClient | null): Promise<BrandLimitContext> {
  const client = admin ?? createSupabaseAdminClient()
  const settings = await loadPlatformSettings(client)
  const inactive: BrandLimitContext = { active: false, plan: 'free', settings, limits: NO_LIMITS, wheel: false }
  if (!settings.free_brand_limits_enabled || !client) return inactive

  const { data: user, error } = await client
    .from('users')
    .select('role, spotlight_active, spotlight_plan, spotlight_expires_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) console.error('[brand-limits] kullanıcı okunamadı:', error.message)
  if (!user || user.role !== 'brand') return inactive

  const plan = brandPlanOf(user)
  const limits: BrandLimits =
    plan === 'pro'
      ? NO_LIMITS
      : plan === 'basic'
        ? {
            offersPerDay: settings.basic_offers_per_day,
            offersPerMonth: settings.basic_offers_per_month,
            activeAdverts: settings.basic_active_adverts,
          }
        : {
            offersPerDay: settings.free_offers_per_day,
            offersPerMonth: settings.free_offers_per_month,
            activeAdverts: settings.free_active_adverts,
          }
  return { active: true, plan, settings, limits, wheel: plan === 'free' }
}

// ---- Türkiye saatiyle gün / ay başı ----
// Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok); DB tarafı aynı sınırı 'Europe/Istanbul' ile hesaplar.

function istanbulParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { year: get('year'), month: get('month'), day: get('day') }
}

export function istanbulDayStart(now: Date = new Date()): string {
  const { year, month, day } = istanbulParts(now)
  return new Date(`${year}-${month}-${day}T00:00:00+03:00`).toISOString()
}

export function istanbulMonthStart(now: Date = new Date()): string {
  const { year, month } = istanbulParts(now)
  return new Date(`${year}-${month}-01T00:00:00+03:00`).toISOString()
}

// ---- Teklif sınırı ----

export interface OfferQuota {
  plan: BrandPlan
  perDay: number | null
  perMonth: number | null
  usedToday: number
  usedThisMonth: number
  remainingToday: number | null
  remainingThisMonth: number | null
}

/** Teklif kotası; sınır yoksa (bayrak kapalı, Pro, değerler boş) null. */
export async function getOfferQuota(userId: string, ctx?: BrandLimitContext): Promise<OfferQuota | null> {
  const context = ctx ?? (await getBrandLimitContext(userId))
  const { offersPerDay, offersPerMonth } = context.limits
  if (!context.active || (offersPerDay === null && offersPerMonth === null)) return null
  const admin = createSupabaseAdminClient()
  if (!admin) return null

  const count = async (since: string) => {
    const { count: n, error } = await admin
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', userId)
      .gte('created_at', since)
    if (error) throw new Error(error.message)
    return n ?? 0
  }
  const [usedToday, usedThisMonth] = await Promise.all([count(istanbulDayStart()), count(istanbulMonthStart())])
  return {
    plan: context.plan,
    perDay: offersPerDay,
    perMonth: offersPerMonth,
    usedToday,
    usedThisMonth,
    remainingToday: offersPerDay === null ? null : Math.max(0, offersPerDay - usedToday),
    remainingThisMonth: offersPerMonth === null ? null : Math.max(0, offersPerMonth - usedThisMonth),
  }
}

const SPOTLIGHT_NOTE = ' Spotlight markalar için sınırlar farklıdır.'

/** Kota doluysa kullanıcıya gösterilecek hata; gönderilebiliyorsa null. */
export function offerQuotaError(quota: OfferQuota | null): string | null {
  if (!quota) return null
  const note = quota.plan === 'free' ? SPOTLIGHT_NOTE : ''
  if (quota.remainingThisMonth === 0) {
    return `Bu ayki teklif hakkın doldu (ayda ${quota.perMonth} teklif). Yeni hakların ay başında açılır.${note}`
  }
  if (quota.remainingToday === 0) {
    const month = quota.remainingThisMonth === null ? '' : ` Bu ay ${quota.remainingThisMonth} teklif hakkın kaldı.`
    return `Bugünkü teklif hakkın doldu (günde ${quota.perDay} teklif); yarın yeniden gönderebilirsin.${month}${note}`
  }
  return null
}

/** Teklif formunun yanındaki kısa bilgi (ör. "Bu ay 12 teklif hakkın kaldı (bugün 2)."). */
export function offerQuotaSummary(quota: OfferQuota | null): string | null {
  if (!quota) return null
  const today = quota.remainingToday === null ? '' : `bugün ${quota.remainingToday}`
  if (quota.remainingThisMonth !== null) {
    return `Bu ay ${quota.remainingThisMonth} teklif hakkın kaldı${today ? ` (${today})` : ''}.`
  }
  return `Bugün ${quota.remainingToday} teklif hakkın kaldı.`
}

// ---- Aktif ilan sınırı ----

export interface AdvertQuota {
  plan: BrandPlan
  limit: number
  open: number
  remaining: number
}

export async function getAdvertQuota(userId: string, ctx?: BrandLimitContext): Promise<AdvertQuota | null> {
  const context = ctx ?? (await getBrandLimitContext(userId))
  const limit = context.limits.activeAdverts
  if (!context.active || limit === null) return null
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const { count, error } = await admin
    .from('advert_projects')
    .select('id', { count: 'exact', head: true })
    .eq('brand_user_id', userId)
    .eq('status', 'open')
  if (error) throw new Error(error.message)
  const open = count ?? 0
  return { plan: context.plan, limit, open, remaining: Math.max(0, limit - open) }
}

export function advertQuotaError(quota: AdvertQuota | null): string | null {
  if (!quota || quota.remaining > 0) return null
  const note = quota.plan === 'free' ? SPOTLIGHT_NOTE : ''
  return `Aynı anda en fazla ${quota.limit} aktif ilanın olabilir. Yeni bir ilanı yayına almak için açık ilanlarından birini duraklat ya da kapat.${note}`
}

/** DB tetikleyicisinin (yedek kontrol) hata metnini kullanıcı mesajına çevirir. */
export function brandLimitErrorFromDb(message: string | null | undefined): string | null {
  if (!message) return null
  if (message.includes('brand_limit:offers_per_day')) return 'Bugünkü teklif hakkın doldu; yarın yeniden gönderebilirsin.'
  if (message.includes('brand_limit:offers_per_month')) return 'Bu ayki teklif hakkın doldu. Yeni hakların ay başında açılır.'
  if (message.includes('brand_limit:active_adverts')) {
    return 'Aktif ilan sınırına ulaştın. Yeni bir ilanı yayına almak için açık ilanlarından birini duraklat ya da kapat.'
  }
  return null
}
