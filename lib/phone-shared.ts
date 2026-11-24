// Telefon numarası biçimi (2026-11-24): istemci + sunucu ortak, saf kod. Mobil kopya mobile-app/constants/phone.js
// (aynı tutulur, tests/mobile-parity.test.ts denetler). Saklanan biçim E.164: +905321234567.
// Türkiye numaraları yaygın yazımlarla kabul edilir (0532 123 45 67, 532..., +90 532...); yurt dışı + ile.

export const PHONE_REQUIRED_ERROR = 'Telefon numaranı gir.'
export const PHONE_INVALID_ERROR = 'Geçerli bir telefon numarası gir (ör. 0532 123 45 67).'

/** Acil durumda ulaşmak için; yalnızca platform görür (kayıt formundaki açıklama). */
export const PHONE_PURPOSE_NOTE =
  'Acil durumda (ör. iş birliğinde yazarak ulaşılamadığında) sana ulaşabilmemiz için. Numaranı yalnızca Influmatch ekibi görür; diğer kullanıcılar göremez.'

export const MARKETING_SMS_LABEL = 'Kampanya ve duyurular için SMS / arama ile ulaşılmasına izin veriyorum (isteğe bağlı).'

export function normalizePhone(raw: unknown): { phone: string } | { error: string } {
  const input = typeof raw === 'string' ? raw.trim() : ''
  if (!input) return { error: PHONE_REQUIRED_ERROR }
  if (!/^[+0-9\s().-]+$/.test(input)) return { error: PHONE_INVALID_ERROR }
  let digits = input.replace(/[^0-9]/g, '')
  const plus = input.startsWith('+')
  if (!plus && digits.startsWith('00')) digits = digits.slice(2)
  else if (!plus) {
    // Türkiye: 05xx xxx xx xx (11 hane) ya da 5xx xxx xx xx (10 hane) ya da 905xx...
    if (digits.length === 11 && digits.startsWith('0')) digits = `90${digits.slice(1)}`
    else if (digits.length === 10 && digits.startsWith('5')) digits = `90${digits}`
  }
  if (digits.startsWith('90')) {
    // Türkiye cep / sabit: 90 + 10 hane, ilk hane 0 olamaz
    if (!/^90[2-9][0-9]{9}$/.test(digits)) return { error: PHONE_INVALID_ERROR }
    return { phone: `+${digits}` }
  }
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) return { error: PHONE_INVALID_ERROR }
  return { phone: `+${digits}` }
}

/** Gösterim: +90 532 123 45 67 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const m = phone.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/)
  return m ? `+90 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone
}
