// Influcash (2026-11-23; SYSTEM_MAP 16). Saf kurallar: sunucu, admin formu, testler ortak kullanır.
// Mobil kopyası: mobile-app/constants/influcash.js (tests/mobile-parity.test.ts eşitliği denetler).
//
// Sahip kararları: Influcash puanı paraya çevrilemez ve devredilemez. Puanla Spotlight indirim kodu (IM-…) ve Spotlight günü alınır;
// markalar da kazanır. İş ortağı kuponları yalnızca altyapı (influcash_partner_coupons_enabled kapalı, arayüz gizli).
// Bayrak influcash_enabled kapalıyken hiçbir puan yazılmaz ve arayüz gizlenir.

export type InflucashReason =
  | 'collab_completed'
  | 'ontime_delivery'
  | 'ontime_payment'
  | 'daily_login'
  | 'login_streak'
  | 'task'
  | 'profile_complete'
  | 'account_verified'
  | 'clawback'
  | 'redeem'
  | 'admin_adjust'

export const INFLUCASH_REASON_LABELS: Record<InflucashReason, string> = {
  collab_completed: 'Tamamlanan iş birliği',
  ontime_delivery: 'Zamanında teslim',
  ontime_payment: 'Zamanında ödeme',
  daily_login: 'Günlük giriş',
  login_streak: 'Giriş serisi',
  task: 'Görev',
  profile_complete: 'Profilini tamamladın',
  account_verified: 'Hesabın doğrulandı',
  clawback: 'Geri alındı',
  redeem: 'Harcama',
  admin_adjust: 'Admin düzeltmesi',
}

/** İş birliğine bağlı kazanımlar: iptal ya da haklı bulunan anlaşmazlıkta geri alınır. */
export const COLLAB_EARN_REASONS: InflucashReason[] = ['collab_completed', 'ontime_delivery', 'ontime_payment']

export type InflucashAudience = 'creator' | 'brand' | 'all'
export type InflucashRewardType = 'spotlight_days' | 'discount_percent' | 'partner_coupon'

export const INFLUCASH_AUDIENCE_LABELS: Record<InflucashAudience, string> = { creator: 'Influencer / UGC', brand: 'Marka', all: 'Herkes' }
export const INFLUCASH_REWARD_LABELS: Record<InflucashRewardType, string> = {
  spotlight_days: 'Spotlight günü',
  discount_percent: 'Spotlight indirim kodu',
  partner_coupon: 'İş ortağı kuponu',
}

/** Puan kuralları (admin düzenler; platform_settings 'influcash_rules'). Tutarlar puandır, para karşılığı yoktur. */
export interface InflucashRules {
  collab_completed: number
  ontime_delivery: number
  ontime_payment: number
  daily_login: number
  streak_7: number
  streak_30: number
  /** Günlük giriş + seri ödülünden bir takvim ayında en fazla kazanılabilecek puan. */
  daily_monthly_cap: number
  task_promo_video: number
  task_story_link: number
  task_invites: number
  task_other: number
  profile_complete: number
  account_verified: number
  /** Saatte en fazla harcama sayısı. */
  redeem_hourly_limit: number
}

export const DEFAULT_INFLUCASH_RULES: InflucashRules = {
  collab_completed: 100,
  ontime_delivery: 20,
  ontime_payment: 50,
  daily_login: 2,
  streak_7: 10,
  streak_30: 50,
  daily_monthly_cap: 100,
  task_promo_video: 150,
  task_story_link: 50,
  task_invites: 75,
  task_other: 50,
  profile_complete: 30,
  account_verified: 50,
  redeem_hourly_limit: 5,
}

export const INFLUCASH_RULE_LABELS: Record<keyof InflucashRules, string> = {
  collab_completed: 'Tamamlanan iş birliği (iki taraf ödemeyi teyit edince, iki tarafa)',
  ontime_delivery: 'Zamanında teslim (teslimat başına, influencer)',
  ontime_payment: 'Zamanında ödeme (marka)',
  daily_login: 'Günlük giriş (İstanbul günü başına bir)',
  streak_7: '7 günlük giriş serisi',
  streak_30: '30 günlük giriş serisi',
  daily_monthly_cap: 'Günlük giriş + seri aylık üst sınırı',
  task_promo_video: 'Görev: tanıtım videosu',
  task_story_link: 'Görev: story bağlantısı',
  task_invites: 'Görev: davet',
  task_other: 'Görev: diğer',
  profile_complete: 'Profil tamamlama (bir kez)',
  account_verified: 'Hesap doğrulama (bir kez)',
  redeem_hourly_limit: 'Saatte en fazla harcama',
}

export const INFLUCASH_RULE_MAX = 100_000

export function normalizeInflucashRules(raw: unknown): InflucashRules {
  const out: InflucashRules = { ...DEFAULT_INFLUCASH_RULES }
  if (!raw || typeof raw !== 'object') return out
  for (const key of Object.keys(DEFAULT_INFLUCASH_RULES) as Array<keyof InflucashRules>) {
    const n = Number((raw as Record<string, unknown>)[key])
    if (Number.isInteger(n) && n >= 0 && n <= INFLUCASH_RULE_MAX) out[key] = n
  }
  if (out.redeem_hourly_limit < 1) out.redeem_hourly_limit = 1
  return out
}

export function validateInflucashRulesInput(input: Record<string, unknown>): InflucashRules | { error: string } {
  const out = { ...DEFAULT_INFLUCASH_RULES }
  for (const key of Object.keys(DEFAULT_INFLUCASH_RULES) as Array<keyof InflucashRules>) {
    const raw = input[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (raw === '' || raw === null || raw === undefined || !Number.isInteger(n) || n < 0 || n > INFLUCASH_RULE_MAX) {
      return { error: `"${INFLUCASH_RULE_LABELS[key]}" 0 ile ${INFLUCASH_RULE_MAX} arasında tam sayı olmalı.` }
    }
    out[key] = n
  }
  if (out.redeem_hourly_limit < 1) return { error: 'Saatlik harcama sınırı en az 1 olmalı.' }
  return out
}

/** Görev türünün puanı. */
export function taskAward(rules: InflucashRules, kind: string): number {
  if (kind === 'promo_video') return rules.task_promo_video
  if (kind === 'story_link') return rules.task_story_link
  if (kind === 'invites') return rules.task_invites
  return rules.task_other
}

/** Türkiye takvim günü (UTC+3, yaz saati yok): YYYY-AA-GG. */
export function istanbulDay(at: Date | number = new Date()): string {
  const t = typeof at === 'number' ? at : at.getTime()
  return new Date(t + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const shiftDay = (day: string, delta: number) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10)

/** Bugün dahil kesintisiz giriş günü sayısı (days: daha önce ödül alınan günler, bugün dahil olabilir). */
export function loginStreak(days: readonly string[], today: string): number {
  const set = new Set(days)
  let streak = 0
  for (let d = today; set.has(d); d = shiftDay(d, -1)) streak++
  return streak
}

export interface DailyAward {
  reason: 'daily_login' | 'login_streak'
  ref: string
  amount: number
}

/**
 * Bugünkü günlük giriş ödülleri. previousDays: bugünden önce ödül alınan günler; monthEarned: bu ay günlük + seri puanı.
 * Seri ödülü 7 ve 30. günde (kesintisiz). Aylık üst sınırı aşan kısım kesilir; sınır doluysa ödül yok (gün yine sayılmaz).
 */
export function dailyLoginAwards(rules: InflucashRules, previousDays: readonly string[], today: string, monthEarned: number): DailyAward[] {
  if (previousDays.includes(today)) return []
  const streak = loginStreak([...previousDays, today], today)
  const wanted: DailyAward[] = []
  if (rules.daily_login > 0) wanted.push({ reason: 'daily_login', ref: today, amount: rules.daily_login })
  if (streak === 7 && rules.streak_7 > 0) wanted.push({ reason: 'login_streak', ref: `7:${today}`, amount: rules.streak_7 })
  if (streak === 30 && rules.streak_30 > 0) wanted.push({ reason: 'login_streak', ref: `30:${today}`, amount: rules.streak_30 })
  let room = Math.max(0, rules.daily_monthly_cap - monthEarned)
  const out: DailyAward[] = []
  for (const a of wanted) {
    if (room <= 0) break
    const amount = Math.min(a.amount, room)
    out.push({ ...a, amount })
    room -= amount
  }
  return out
}

export interface LedgerLike {
  reason: InflucashReason
  ref: string
  amount: number
}

/**
 * Geri alım hareketleri: verilen referanslara (iş birliği / teslimat kimlikleri) bağlı iş birliği kazanımları için eksi hareket.
 * Referansı "neden:ref" olur (aynı kazanım iki kez geri alınmaz).
 */
export function clawbackEntries(ledger: readonly LedgerLike[], refs: readonly string[]): LedgerLike[] {
  const wanted = new Set(refs)
  const done = new Set(ledger.filter((l) => l.reason === 'clawback').map((l) => l.ref))
  return ledger
    .filter((l) => COLLAB_EARN_REASONS.includes(l.reason) && l.amount > 0 && wanted.has(l.ref) && !done.has(`${l.reason}:${l.ref}`))
    .map((l) => ({ reason: 'clawback' as const, ref: `${l.reason}:${l.ref}`, amount: -l.amount }))
}

/** Harcama için kullanılabilir bakiye (eksi bakiye 0 sayılır). */
export const spendableBalance = (balance: number) => Math.max(0, balance)

export interface CatalogItemLike {
  active: boolean
  audience: InflucashAudience
  cost: number
  stock: number | null
  reward_type: InflucashRewardType
}

/** Katalog ürünü bu kullanıcı için alınabilir mi (sunucu ve arayüz aynı kural; asıl kontrol veritabanı fonksiyonunda). */
export function redeemBlocker(
  item: CatalogItemLike,
  ctx: { audience: 'creator' | 'brand'; balance: number; partnerCouponsEnabled: boolean; recentRedemptions: number; hourlyLimit: number },
): string | null {
  if (!item.active || (item.audience !== 'all' && item.audience !== ctx.audience)) return 'Bu ödül şu an alınamaz.'
  if (item.reward_type === 'partner_coupon' && !ctx.partnerCouponsEnabled) return 'Bu ödül şu an alınamaz.'
  if (item.stock !== null && item.stock <= 0) return 'Bu ödülün stoğu bitti.'
  if (ctx.recentRedemptions >= ctx.hourlyLimit) return 'Çok sık harcama yaptın. Biraz sonra tekrar dene.'
  if (spendableBalance(ctx.balance) < item.cost) return 'Influcash bakiyen yetmiyor.'
  return null
}

export const INFLUCASH_RULE_NOTE = 'Influcash puanı paraya çevrilemez ve başka hesaba devredilemez.'
