// Platform ayarlarının tipleri, varsayılanları ve doğrulaması (sunucu ve admin formu ortak kullanır).
// Varsayılanlar kullanıcı kararıdır (2026-10-10, 3. tur). null = sınırsız.

export interface PlatformSettings {
  /** Ücretsiz marka sınırları ve keşif çarkı. Satış başlayınca admin açar; o zamana kadar KAPALI. */
  free_brand_limits_enabled: boolean
  wheel_profiles_per_day: number
  wheel_window_hours: number
  free_offers_per_day: number | null
  free_offers_per_month: number | null
  free_active_adverts: number | null
  basic_offers_per_day: number | null
  basic_offers_per_month: number | null
  basic_active_adverts: number | null
}

export const PLATFORM_SETTING_KEYS = [
  'free_brand_limits_enabled',
  'wheel_profiles_per_day',
  'wheel_window_hours',
  'free_offers_per_day',
  'free_offers_per_month',
  'free_active_adverts',
  'basic_offers_per_day',
  'basic_offers_per_month',
  'basic_active_adverts',
] as const satisfies readonly (keyof PlatformSettings)[]

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  free_brand_limits_enabled: false,
  wheel_profiles_per_day: 10,
  wheel_window_hours: 24,
  free_offers_per_day: 3,
  free_offers_per_month: 15,
  free_active_adverts: 1,
  basic_offers_per_day: null,
  basic_offers_per_month: null,
  basic_active_adverts: null,
}

export const WHEEL_PROFILES_RANGE = { min: 1, max: 50 } as const
export const WHEEL_HOURS_RANGE = { min: 1, max: 168 } as const
export const LIMIT_MAX = 10_000

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.floor(n) : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** DB'den gelen ham değerleri güvenli tipe çevirir; bozuk değer yerine varsayılan kullanılır. */
export function normalizePlatformSettings(raw: Record<string, unknown>): PlatformSettings {
  const out: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS }
  out.free_brand_limits_enabled = raw.free_brand_limits_enabled === true
  const wheel = toInt(raw.wheel_profiles_per_day)
  if (wheel !== null) out.wheel_profiles_per_day = clamp(wheel, WHEEL_PROFILES_RANGE.min, WHEEL_PROFILES_RANGE.max)
  const hours = toInt(raw.wheel_window_hours)
  if (hours !== null) out.wheel_window_hours = clamp(hours, WHEEL_HOURS_RANGE.min, WHEEL_HOURS_RANGE.max)
  for (const key of [
    'free_offers_per_day',
    'free_offers_per_month',
    'free_active_adverts',
    'basic_offers_per_day',
    'basic_offers_per_month',
    'basic_active_adverts',
  ] as const) {
    if (!(key in raw)) continue
    const n = toInt(raw[key])
    out[key] = n === null ? null : clamp(n, 0, LIMIT_MAX)
  }
  return out
}

/** Admin formundan gelen değerleri doğrular (boş = sınırsız). */
export function validatePlatformSettingsInput(input: Record<string, unknown>): PlatformSettings | { error: string } {
  if (typeof input.free_brand_limits_enabled !== 'boolean') return { error: 'Bayrak değeri geçersiz.' }
  const wheel = toInt(input.wheel_profiles_per_day)
  if (wheel === null || wheel < WHEEL_PROFILES_RANGE.min || wheel > WHEEL_PROFILES_RANGE.max) {
    return { error: `Çarktaki profil sayısı ${WHEEL_PROFILES_RANGE.min}-${WHEEL_PROFILES_RANGE.max} arasında olmalı.` }
  }
  const hours = toInt(input.wheel_window_hours)
  if (hours === null || hours < WHEEL_HOURS_RANGE.min || hours > WHEEL_HOURS_RANGE.max) {
    return { error: `Çark süresi ${WHEEL_HOURS_RANGE.min}-${WHEEL_HOURS_RANGE.max} saat arasında olmalı.` }
  }
  const out: PlatformSettings = {
    ...DEFAULT_PLATFORM_SETTINGS,
    free_brand_limits_enabled: input.free_brand_limits_enabled,
    wheel_profiles_per_day: wheel,
    wheel_window_hours: hours,
  }
  for (const key of [
    'free_offers_per_day',
    'free_offers_per_month',
    'free_active_adverts',
    'basic_offers_per_day',
    'basic_offers_per_month',
    'basic_active_adverts',
  ] as const) {
    const value = input[key]
    if (value === null || value === undefined || value === '') {
      out[key] = null
      continue
    }
    const n = toInt(value)
    if (n === null || n < 0 || n > LIMIT_MAX || String(value).includes('.')) {
      return { error: 'Sınırlar 0 ile 10.000 arasında tam sayı olmalı (boş = sınırsız).' }
    }
    out[key] = n
  }
  return out
}
