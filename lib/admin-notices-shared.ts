// Admin duyuruları (2026-10-19): admin bir kullanıcının içeriğini kaldırdığında (ör. ilan) kullanıcı bildirim alır ve panele
// ilk girişinde pencere (pop-up) olarak görür. Ayrı tablo yok: normal bildirim (notifications) satırıdır; bağlantısındaki
// `duyuru=` işareti onu pencerede gösterilecek duyuru yapar. Okundu işaretlenince bir daha açılmaz. Web ve mobil aynı kural.

export const ADMIN_NOTICE_PARAM = 'duyuru'

export type AdminNoticeKind = 'ilan-kaldirildi'

/** Duyurunun bağlantısı (bildirim listesinde tıklanınca ilgili sayfayı açar). */
export function adminNoticeLink(kind: AdminNoticeKind): string {
  if (kind === 'ilan-kaldirildi') return `/dashboard/brand/advert?${ADMIN_NOTICE_PARAM}=${kind}`
  return `/dashboard?${ADMIN_NOTICE_PARAM}=${kind}`
}

export function isAdminNoticeLink(link: string | null | undefined): boolean {
  return typeof link === 'string' && new RegExp(`[?&]${ADMIN_NOTICE_PARAM}=`).test(link)
}

/** Pencerede gösterilecek duyuru. */
export interface AdminNotice {
  id: string
  title: string
  message: string
  created_at: string
}

/** Kaldırma nedeni: zorunlu, kısa. */
export const REMOVAL_REASON_MAX = 300

export function cleanRemovalReason(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const reason = value.replace(/\s+/g, ' ').trim()
  if (reason.length < 3) return null
  return reason.slice(0, REMOVAL_REASON_MAX)
}
