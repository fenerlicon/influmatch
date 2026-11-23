// Ödeme ve abonelik kurallarının saf (veritabanı / ağ kullanmayan) kısmı. Sunucu kodu, admin ekranı ve testler ortak kullanır.
// Fiyatlar lib/spotlight-plans.ts'ten gelir (iş kararı; değiştirmeden önce kullanıcıya sorulur).
// İndirim kuralları (2026-10-15 / 2026-10-18 kararları, docs/ROADMAP.md):
//  - 0₺ döneminde Spotlight Pro kullananlara satış başlayınca **ilk ay %50** (yalnızca aylık planda, ilk ücretli abonelikte, bir kez).
//  - Görev ödülü indirim kodu (`IM-XXXXXXXX`, task_rewards): tek kullanımlık, kişiye özel.
//  - İkisi birleşmez, büyük olan geçer. Kod "2. aydan itibaren ya da yıllık planda" kullanılır: aylıkta ilk ay %50 geçerse
//    kod saklanır, sonraki bir yenilemeye (aktif abonelikte "Kodu kullan") ya da yıllık plana uygulanır.

import { SPOTLIGHT_PLAN_AMOUNTS, type BillingInterval, type SpotlightPlanCode } from '@/lib/spotlight-plans'

export type { BillingInterval, SpotlightPlanCode }

export type SubscriptionSource = 'iyzico' | 'apple' | 'google' | 'admin' | 'promo' | 'reward'
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled' | 'expired'
export type DiscountKind = 'promo_first_period' | 'task_code'
export type BillingRole = 'influencer' | 'brand'

/** Ücretli (yinelenen) kaynaklar. Kullanıcı başına en fazla bir canlı ücretli abonelik olur (web ya da mağaza). */
export const PAID_SOURCES: readonly SubscriptionSource[] = ['iyzico', 'apple', 'google']
export const LIVE_PAID_STATUSES: readonly SubscriptionStatus[] = ['pending', 'active', 'past_due']

/** Yenileme ödemesi alınamazsa Spotlight bu kadar gün daha açık kalır (past_due), sonra kapanır. */
export const PAST_DUE_GRACE_DAYS = 3
/** Yıllık yenilemeden bu kadar gün önce hatırlatma. */
export const YEARLY_RENEWAL_REMINDER_DAYS = 7
/** Süreli (admin / 0₺ / ödül) üyelik bitmeden bu kadar gün önce "üyeliğin bitiyor" bildirimi. */
export const EXPIRY_NOTICE_DAYS = 7
/** Ödeme sayfasında başlatılıp tamamlanmayan kayıt bu süreden sonra düşer (iyzico form token süresinden uzun). */
export const PENDING_CHECKOUT_TTL_MINUTES = 60
/** 0₺ dönemi geçiş indirimi (yüzde). */
export const PROMO_FIRST_PERIOD_PERCENT = 50

export const DAY_MS = 86_400_000

export const PLAN_ROLE: Record<SpotlightPlanCode, BillingRole> = {
  ibasic: 'influencer',
  ipro: 'influencer',
  mbasic: 'brand',
  mpro: 'brand',
}

export const PLAN_LABELS: Record<SpotlightPlanCode, string> = {
  ibasic: 'Spotlight Basic',
  ipro: 'Spotlight Pro',
  mbasic: 'Spotlight Basic',
  mpro: 'Spotlight Pro',
}

export const SOURCE_LABELS: Record<SubscriptionSource, string> = {
  iyzico: 'Kartla ödeme (web)',
  apple: 'App Store',
  google: 'Google Play',
  admin: 'Yönetici tanımı',
  promo: '0₺ dönemi',
  reward: 'Görev ödülü',
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending: 'Ödeme bekleniyor',
  active: 'Aktif',
  past_due: 'Ödeme alınamadı',
  canceled: 'İptal edildi',
  expired: 'Sona erdi',
}

export function isPlanCode(value: unknown): value is SpotlightPlanCode {
  return value === 'ibasic' || value === 'ipro' || value === 'mbasic' || value === 'mpro'
}

export function isInterval(value: unknown): value is BillingInterval {
  return value === 'mo' || value === 'yr'
}

export function isPaidSource(source: string | null | undefined): boolean {
  return !!source && (PAID_SOURCES as readonly string[]).includes(source)
}

export function isProPlanCode(plan: string | null | undefined): boolean {
  return plan === 'ipro' || plan === 'mpro'
}

export function plansForRole(role: BillingRole): [SpotlightPlanCode, SpotlightPlanCode] {
  return role === 'brand' ? ['mbasic', 'mpro'] : ['ibasic', 'ipro']
}

export function proPlanForRole(role: BillingRole): SpotlightPlanCode {
  return role === 'brand' ? 'mpro' : 'ipro'
}

/** Plan bu rol için satın alınabilir mi (influencer yalnızca ibasic/ipro, marka yalnızca mbasic/mpro). */
export function planMatchesRole(plan: string | null | undefined, role: string | null | undefined): boolean {
  return isPlanCode(plan) && (role === 'influencer' || role === 'brand') && PLAN_ROLE[plan] === role
}

/** Aynı rol içinde plan değişikliği (Basic ↔ Pro). Dönem değişikliği (aylık ↔ yıllık) iyzico'da aynı abonelikle yapılamaz. */
export function planChangeAllowed(from: SpotlightPlanCode, to: SpotlightPlanCode): boolean {
  return from !== to && PLAN_ROLE[from] === PLAN_ROLE[to]
}

export function isUpgrade(from: SpotlightPlanCode, to: SpotlightPlanCode): boolean {
  return !isProPlanCode(from) && isProPlanCode(to)
}

// ---------------------------------------------------------------------------
// Tutarlar (kuruş hassasiyetinde, iyzico'ya "149.0" gibi ondalık metin gider)
// ---------------------------------------------------------------------------

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function baseAmount(plan: SpotlightPlanCode, interval: BillingInterval): number {
  return SPOTLIGHT_PLAN_AMOUNTS[plan][interval]
}

export function discountedAmount(amount: number, percent: number | null | undefined): number {
  if (!percent) return roundMoney(amount)
  return roundMoney((amount * (100 - percent)) / 100)
}

/** "1.490,00 ₺" biçimi (yalnızca gösterim). */
export function formatTry(amount: number): string {
  return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ₺`
}

// ---------------------------------------------------------------------------
// İndirim kodu ve fiyat hesabı (istemci tutar göndermez; tutar her zaman sunucuda bu fonksiyonla hesaplanır)
// ---------------------------------------------------------------------------

export const DISCOUNT_CODE_PATTERN = /^IM-[A-Z0-9]{8}$/

export function normalizeDiscountCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  if (!code) return null
  return DISCOUNT_CODE_PATTERN.test(code) ? code : null
}

export interface PriceInput {
  plan: SpotlightPlanCode
  interval: BillingInterval
  /** 0₺ döneminde Pro kullanmış, ilk ücretli aboneliği (lib/payments/subscriptions.ts promoDiscountEligible). */
  promoEligible: boolean
  /** Geçerli, kullanılmamış görev kodu yüzdesi (yoksa null). */
  codePercent: number | null
}

export interface PriceQuote {
  baseAmount: number
  amount: number
  discountKind: DiscountKind | null
  discountPercent: number | null
  /** Kod bu ödemede kullanılmadıysa (ilk ay %50 daha büyük) neden; kod saklı kalır. */
  codeDeferred: boolean
}

/** İlk dönemin fiyatı. Birleşmez, büyük olan geçer; eşitse ilk ay indirimi (kod sonraki yenilemeye kalır). */
export function quoteFirstPeriod(input: PriceInput): PriceQuote {
  const base = baseAmount(input.plan, input.interval)
  const promo = input.promoEligible && input.interval === 'mo' ? PROMO_FIRST_PERIOD_PERCENT : 0
  const code = input.codePercent && input.codePercent > 0 ? Math.min(90, Math.floor(input.codePercent)) : 0
  if (!promo && !code) return { baseAmount: base, amount: base, discountKind: null, discountPercent: null, codeDeferred: false }
  if (promo >= code) {
    return {
      baseAmount: base,
      amount: discountedAmount(base, promo),
      discountKind: 'promo_first_period',
      discountPercent: promo,
      codeDeferred: code > 0,
    }
  }
  return { baseAmount: base, amount: discountedAmount(base, code), discountKind: 'task_code', discountPercent: code, codeDeferred: false }
}

// ---------------------------------------------------------------------------
// iyzico fiyatlandırma planı adları (betik ve sunucu aynı adı üretir; referans kodu iyzico'dan ada göre bulunur)
// ---------------------------------------------------------------------------

export const IYZICO_PRODUCT_NAMES: Record<BillingRole, string> = {
  influencer: 'Influmatch Spotlight Influencer',
  brand: 'Influmatch Spotlight Marka',
}

/** Sync betiğinin varsayılan olarak oluşturduğu indirimli plan yüzdeleri (ilk ay %50 + görev kodu %20). */
export const IYZICO_DISCOUNT_PERCENTS = [20, 50] as const

export function pricingPlanName(plan: SpotlightPlanCode, interval: BillingInterval, discountPercent?: number | null): string {
  return `IM-${plan}-${interval}${discountPercent ? `-D${discountPercent}` : ''}`
}

export function parsePricingPlanName(name: string): { plan: SpotlightPlanCode; interval: BillingInterval; discountPercent: number | null } | null {
  const m = /^IM-(ibasic|ipro|mbasic|mpro)-(mo|yr)(?:-D(\d{1,2}))?$/.exec(name.trim())
  if (!m) return null
  return { plan: m[1] as SpotlightPlanCode, interval: m[2] as BillingInterval, discountPercent: m[3] ? Number(m[3]) : null }
}

// ---------------------------------------------------------------------------
// Mağaza ürün kimlikleri (App Store Connect + Play Console'da aynı kimliklerle açılır; mobil kopyası constants/iap.js)
// ---------------------------------------------------------------------------

export const STORE_PRODUCT_IDS: Record<SpotlightPlanCode, Record<BillingInterval, string>> = {
  ibasic: { mo: 'net.influmatch.app.ibasic.monthly', yr: 'net.influmatch.app.ibasic.yearly' },
  ipro: { mo: 'net.influmatch.app.ipro.monthly', yr: 'net.influmatch.app.ipro.yearly' },
  mbasic: { mo: 'net.influmatch.app.mbasic.monthly', yr: 'net.influmatch.app.mbasic.yearly' },
  mpro: { mo: 'net.influmatch.app.mpro.monthly', yr: 'net.influmatch.app.mpro.yearly' },
}

export function planFromStoreProductId(productId: string | null | undefined): { plan: SpotlightPlanCode; interval: BillingInterval } | null {
  if (!productId) return null
  for (const plan of Object.keys(STORE_PRODUCT_IDS) as SpotlightPlanCode[]) {
    for (const interval of ['mo', 'yr'] as BillingInterval[]) {
      if (STORE_PRODUCT_IDS[plan][interval] === productId) return { plan, interval }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Spotlight hakkı: bütün kaynaklardan tek kural
// ---------------------------------------------------------------------------

export interface SubscriptionLike {
  id: string
  plan: string
  source: string
  status: string
  current_period_end: string | null
  cancel_at_period_end?: boolean | null
  grace_until?: string | null
  created_at?: string | null
}

export interface Entitlement {
  plan: SpotlightPlanCode
  /** null = süresiz. users.spotlight_expires_at'e yazılır. */
  expiresAt: string | null
  source: SubscriptionSource
  subscriptionId: string
}

/** Bir kaydın Spotlight hakkının bittiği an (null = süresiz). Hakkı yoksa undefined. */
export function entitlementEnd(row: SubscriptionLike, now: Date = new Date()): string | null | undefined {
  let end: string | null
  if (row.status === 'active') {
    if (row.current_period_end === null) {
      // Süresiz yalnızca admin tanımında olur; ücretli kayıtta bitiş tarihi zorunlu.
      if (isPaidSource(row.source)) return undefined
      end = null
    } else if (isPaidSource(row.source) && !row.cancel_at_period_end) {
      // Yinelenen ücretli abonelik: yenileme bildirimi gecikirse Spotlight kesilmesin diye dönem sonu + ek süre.
      end = new Date(new Date(row.current_period_end).getTime() + PAST_DUE_GRACE_DAYS * DAY_MS).toISOString()
    } else {
      end = row.current_period_end
    }
  } else if (row.status === 'past_due') {
    end = row.grace_until ?? row.current_period_end
    if (!end) return undefined
  } else {
    return undefined
  }
  if (end !== null && new Date(end).getTime() <= now.getTime()) return undefined
  return end
}

/**
 * Kullanıcının bütün aboneliklerinden geçerli Spotlight hakkı: rolüne uyan, hakkı süren kayıtlar arasından
 * Pro > Basic, sonra en geç biten (süresiz en uzun). Hiçbiri yoksa null (Spotlight kapalı).
 */
export function resolveEntitlement(rows: SubscriptionLike[], role: string | null | undefined, now: Date = new Date()): Entitlement | null {
  let best: Entitlement | null = null
  let bestRank = -1
  let bestEnd = -1
  for (const row of rows) {
    if (!planMatchesRole(row.plan, role)) continue
    const end = entitlementEnd(row, now)
    if (end === undefined) continue
    const rank = isProPlanCode(row.plan) ? 1 : 0
    const endMs = end === null ? Number.POSITIVE_INFINITY : new Date(end).getTime()
    if (rank > bestRank || (rank === bestRank && endMs > bestEnd)) {
      best = { plan: row.plan as SpotlightPlanCode, expiresAt: end, source: row.source as SubscriptionSource, subscriptionId: row.id }
      bestRank = rank
      bestEnd = endMs
    }
  }
  return best
}

/** Kullanıcının canlı ücretli aboneliği (yeni satın almayı engeller; web ve mobilde "aktif aboneliğin var"). */
export function livePaidSubscription<T extends SubscriptionLike>(rows: T[]): T | null {
  return rows.find((r) => isPaidSource(r.source) && (LIVE_PAID_STATUSES as readonly string[]).includes(r.status) && r.status !== 'pending') ?? null
}

/** Ödeme alınamayınca ek süre sonu. */
export function graceUntil(from: Date = new Date()): string {
  return new Date(from.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS).toISOString()
}

/** Yıllık yenileme hatırlatması zamanı geldi mi (bitişe ≤ 7 gün, bu dönem için gönderilmemiş). */
export function renewalReminderDue(
  row: { billing_interval: string | null; status: string; cancel_at_period_end: boolean | null; current_period_end: string | null; renewal_reminder_for: string | null; source: string },
  now: Date = new Date(),
): boolean {
  if (row.billing_interval !== 'yr' || row.status !== 'active' || row.cancel_at_period_end || !isPaidSource(row.source)) return false
  if (!row.current_period_end) return false
  const endMs = new Date(row.current_period_end).getTime()
  if (endMs <= now.getTime() || endMs - now.getTime() > YEARLY_RENEWAL_REMINDER_DAYS * DAY_MS) return false
  return row.renewal_reminder_for !== row.current_period_end
}

/** Süreli (yenilenmeyen) üyelik bitiş bildirimi zamanı geldi mi. Ücretli kayıtta iptal edilmişse de bildirilir. */
export function expiryNoticeDue(
  row: { status: string; source: string; cancel_at_period_end: boolean | null; current_period_end: string | null; expiry_notice_for: string | null },
  now: Date = new Date(),
): boolean {
  if (row.status !== 'active' || !row.current_period_end) return false
  if (isPaidSource(row.source) && !row.cancel_at_period_end) return false
  const endMs = new Date(row.current_period_end).getTime()
  if (endMs <= now.getTime() || endMs - now.getTime() > EXPIRY_NOTICE_DAYS * DAY_MS) return false
  return row.expiry_notice_for !== row.current_period_end
}

/**
 * İlk ay %50 (0₺ döneminde Spotlight Pro kullananlar, 2026-10-15 kararı): 0₺ dönemi Pro kaydı var, daha önce başlamış
 * (dönem başı yazılmış) ücretli abonelik yok, (ayarlıysa) son gün geçmemiş. Yarım kalan ödeme hakkı yakmaz.
 */
export function promoDiscountEligible(
  rows: Array<{ source: string; plan: string; status: string; current_period_start: string | null }>,
  promoDiscountUntil: string | null,
  now: Date = new Date(),
): boolean {
  if (promoDiscountUntil && new Date(promoDiscountUntil).getTime() < now.getTime()) return false
  const hadPromoPro = rows.some((r) => r.source === 'promo' && isProPlanCode(r.plan) && r.status !== 'pending')
  if (!hadPromoPro) return false
  return !rows.some((r) => isPaidSource(r.source) && !!r.current_period_start)
}
