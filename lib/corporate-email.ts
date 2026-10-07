// Kurumsal e-posta kuralları (istemci ve sunucu ortak kullanır).
//
// Markalar şirket web sitesinin alan adına ait bir e-posta girmek zorundadır
// (ör. site marka.com.tr ise ad@marka.com.tr veya ad@mail.marka.com.tr).
// Bu e-posta kodla doğrulanmadan "Resmi İşletme" (sarı tik) verilmez: belgeyi yükleyen kişinin
// şirketin alan adını gerçekten kontrol ettiğini gösterir.

/** Kurumsal sayılmayan ücretsiz / kişisel e-posta sağlayıcıları. */
export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.tr', 'outlook.com', 'outlook.com.tr', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.com.tr', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'yandex.com', 'yandex.com.tr', 'yandex.ru',
  'mail.ru', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net', 'aol.com', 'zoho.com', 'mynet.com', 'windowslive.com',
  'tutanota.com', 'hey.com', 'fastmail.com', 'qq.com', '163.com',
])

/** İki parçalı uzantılar: "marka.com.tr" kayıtlı alan adıdır, "com.tr" değil. */
const MULTI_PART_SUFFIXES = new Set([
  'com.tr', 'net.tr', 'org.tr', 'gen.tr', 'biz.tr', 'info.tr', 'web.tr', 'tv.tr', 'av.tr', 'dr.tr', 'bel.tr', 'pol.tr',
  'edu.tr', 'gov.tr', 'k12.tr', 'tel.tr', 'name.tr', 'bbs.tr', 'tsk.tr', 'kep.tr',
  'co.uk', 'org.uk', 'com.au', 'co.de', 'com.de', 'co.jp', 'com.br', 'com.cy', 'com.az',
])

/** "https://www.Marka.com.tr/urunler?x=1" -> "marka.com.tr" */
export function websiteHost(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const value = url.trim().toLowerCase()
  try {
    const host = new URL(value.includes('://') ? value : `https://${value}`).hostname
    return host.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** Kayıtlı (satın alınan) alan adı: "shop.marka.com.tr" -> "marka.com.tr" */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const lastTwo = parts.slice(-2).join('.')
  return MULTI_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo
}

export function emailDomain(email: string): string | null {
  const match = email.trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/)
  return match ? match[1] : null
}

export type CorporateEmailValidation = { isValid: true; email: string; domain: string } | { isValid: false; error: string }

export function validateCorporateEmail(email: string, website: string | null | undefined): CorporateEmailValidation {
  const normalized = email.trim().toLowerCase()
  const domain = emailDomain(normalized)
  if (!domain) return { isValid: false, error: 'Geçerli bir e-posta adresi girin.' }
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return { isValid: false, error: 'Gmail, Hotmail gibi kişisel e-postalar kabul edilmez. Şirketinizin alan adına ait e-postayı girin.' }
  }

  const host = websiteHost(website)
  if (!host) return { isValid: false, error: 'Kurumsal e-posta için önce şirketinizin web sitesini girin.' }
  if (registrableDomain(domain) !== registrableDomain(host)) {
    return { isValid: false, error: `E-posta, web sitenizin alan adına (${registrableDomain(host)}) ait olmalı.` }
  }
  return { isValid: true, email: normalized, domain }
}
