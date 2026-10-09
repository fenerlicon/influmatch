// İlan alarmı eşleştirmesi: sunucu (saatlik görev) ve istemci (önizleme) ortak kodu. Gizli bilgi yok.
// Mobil kopyası: mobile-app/constants/advertAlerts.js (aynı tutulmalı).

export const ADVERT_ALERT_LIMIT = 5
export const SAVED_ADVERT_LIMIT = 200

export const ADVERT_ALERT_PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
] as const
export type AdvertAlertPlatform = (typeof ADVERT_ALERT_PLATFORMS)[number]['key']

export interface AdvertAlertRule {
  category: string | null
  platform: string | null
  min_budget: number | null
}

export interface AlertableAdvert {
  category: string | null
  title?: string | null
  platforms: string[] | null
  budget_min: number | string | null
  budget_max: number | string | null
}

/** Karşılaştırma için sadeleştirme: küçük harf (Türkçe), aksan ve noktalama yok ("İnstagram" = "instagram"). */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** İlanın üst bütçesi (yoksa alt bütçe); bütçe girilmemişse null. */
export function advertBudgetTop(advert: AlertableAdvert): number | null {
  const max = advert.budget_max === null || advert.budget_max === undefined ? NaN : Number(advert.budget_max)
  if (Number.isFinite(max) && max > 0) return max
  const min = advert.budget_min === null || advert.budget_min === undefined ? NaN : Number(advert.budget_min)
  return Number.isFinite(min) && min > 0 ? min : null
}

/**
 * Alarm ilana uyuyor mu. Boş alan "fark etmez" demektir.
 * - Kategori: ilanın kategorisi veya başlığı alarmdaki kelimeyi içeriyor (büyük/küçük harf ve aksan farkı yok).
 * - Platform: ilanın platform listesinde var.
 * - En az bütçe: ilanın üst bütçesi bu tutara ulaşıyor (bütçesi girilmemiş ilan uymaz).
 */
export function advertMatchesAlert(advert: AlertableAdvert, alert: AdvertAlertRule): boolean {
  const keyword = normalizeText(alert.category)
  if (keyword) {
    const haystack = `${normalizeText(advert.category)} ${normalizeText(advert.title)}`
    if (!haystack.includes(keyword)) return false
  }
  const platform = normalizeText(alert.platform)
  if (platform) {
    const platforms = (advert.platforms ?? []).map((p) => normalizeText(p))
    if (!platforms.includes(platform)) return false
  }
  if (alert.min_budget !== null && alert.min_budget !== undefined && Number(alert.min_budget) > 0) {
    const top = advertBudgetTop(advert)
    if (top === null || top < Number(alert.min_budget)) return false
  }
  return true
}

export function describeAlert(alert: AdvertAlertRule): string {
  const parts: string[] = []
  if (alert.category) parts.push(`"${alert.category}"`)
  if (alert.platform) parts.push(ADVERT_ALERT_PLATFORMS.find((p) => p.key === alert.platform)?.label ?? alert.platform)
  if (alert.min_budget) parts.push(`en az ${Number(alert.min_budget).toLocaleString('tr-TR')} ₺`)
  return parts.length ? parts.join(' · ') : 'Tüm yeni ilanlar'
}
