// KVKK rıza ve veri hakları sabitleri (istemci + sunucu ortak; saf kod).
// Mobil kopya: mobile-app/constants/consent.js (aynı tutulur, tests/mobile-parity.test.ts denetler).
//
// Sürüm, kullanıcının onayladığı metnin hangisi olduğunu kayda geçirmek içindir. Yasal metinlerin tek kaynağı
// app/legal/page.tsx; avukattan gelen yeni metin yerleştirildiğinde sürüm o metnin tarihine çekilir
// (çerez politikası değişirse çerez sürümü de; banner bu durumda tercihi yeniden sorar).

/** app/legal/page.tsx "Son Güncelleme" / "Yürürlük Tarihi" (Kullanım Koşulları + Gizlilik). */
export const LEGAL_CONSENT_VERSION = '2026-01-01'

/** app/legal/page.tsx Çerez Politikası sürümü. */
export const COOKIE_POLICY_VERSION = '2026-01-01'

export const CONSENT_KINDS = ['terms_privacy', 'cookies_optional', 'marketing_email'] as const
export type ConsentKind = (typeof CONSENT_KINDS)[number]

/** Alt bilgideki / ayarlardaki "Çerez tercihleri" bağlantısı bu tarayıcı olayını yayınlar; çerez banner'ı yeniden açılır. */
export const COOKIE_PREFERENCES_EVENT = 'influmatch:cookie-preferences'

/** "Verilerimi indir" iki istek arasında en az bu kadar dakika (kullanıcı başına). */
export const DATA_EXPORT_COOLDOWN_MINUTES = 10

/** Çerez tercihi çerezinin değeri: "all.2026-01-01" / "essential.2026-01-01" (eski kayıtlar sürümsüz: "all"). */
export type CookieChoice = 'essential' | 'all'

export function encodeCookieChoice(choice: CookieChoice, version: string = COOKIE_POLICY_VERSION): string {
  return `${choice}.${version}`
}

/**
 * Çerez değerini çözer. Sürümsüz eski değer geçerli sayılır (politika o zamandan beri değişmedi);
 * farklı sürümle verilmiş tercih geçersizdir (politika değişti, yeniden sorulur).
 */
export function decodeCookieChoice(raw: string | null | undefined, currentVersion: string = COOKIE_POLICY_VERSION): CookieChoice | null {
  if (!raw) return null
  const dot = raw.indexOf('.')
  const choice = dot === -1 ? raw : raw.slice(0, dot)
  const version = dot === -1 ? null : raw.slice(dot + 1)
  if (choice !== 'essential' && choice !== 'all') return null
  if (version !== null && version !== currentVersion) return null
  return choice
}
