// Kurucu Üye rozeti (kullanıcı kararı 2026-10-26, SYSTEM_MAP 3.21-N3): hesabı 0₺ kampanyası başlamadan önce doğrulanan
// (users.verification_status = 'verified') her influencer, UGC ve marka hesabı kalıcı olarak alır. Verildikten sonra geri alınmaz.
// Son tarih platform ayarı 'founder_badge_cutoff' (admin /admin/tasks). Ayar boşsa (null) son tarih henüz belirlenmemiştir:
// o ana kadar doğrulanan herkes hak kazanır.
//
// Saf fonksiyonlar: sunucu (lib/founder-badge.ts), admin formu ve testler ortak kullanır.

export const FOUNDER_BADGE_ID = 'founder-member'
export const FOUNDER_CUTOFF_KEY = 'founder_badge_cutoff'
export const FOUNDER_BADGE_ROLES = ['influencer', 'brand'] as const

/** Admin formundaki tarih-saat Türkiye saatidir (UTC+3, yaz saati uygulaması yok). */
const ISTANBUL_OFFSET = '+03:00'

/** Ayar değerini doğrular: geçerli bir ISO zaman damgası ya da null (belirlenmemiş). */
export function normalizeFounderCutoff(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

/** Rozet şu an veriliyor mu: son tarih belirlenmemişse ya da henüz gelmemişse evet. */
export function founderWindowOpen(cutoff: string | null, now: number = Date.now()): boolean {
  if (!cutoff) return true
  const time = Date.parse(cutoff)
  if (!Number.isFinite(time)) return true
  return now < time
}

/** 'YYYY-AA-GGTSS:DD' (Türkiye saati) → ISO (UTC). Geçersizse null. */
export function istanbulLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((local ?? '').trim())
  if (!match) return null
  const time = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00${ISTANBUL_OFFSET}`)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

/** ISO (UTC) → 'YYYY-AA-GGTSS:DD' (Türkiye saati), datetime-local alanı için. */
export function isoToIstanbulLocal(iso: string | null): string {
  if (!iso) return ''
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return ''
  return new Date(time + 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

/** Rozet bildirimi bağlantısı (rol başına rozet sayfası; mobil bunu Rozetler / marka profili ekranına çevirir). */
export function founderNoticeLink(role: string | null | undefined): string {
  return role === 'brand' ? '/dashboard/brand/badges' : '/dashboard/influencer/badges'
}
