// Müsaitlik (yol haritası özellik 4, 2026-10-14; SYSTEM_MAP 3.19): influencer/UGC "İş alıyorum" / "Şu an dolu".
// "Dolu" için isteğe bağlı not ve bitiş tarihi; tarih geçince durum kendiliğinden "İş alıyorum"a döner (okurken hesaplanır).
// Sunucu ve tarayıcı ortak (sunucuya özel içe aktarım yok). Mobil karşılığı: mobile-app/constants/availability.js.

export type AvailabilityStatus = 'open' | 'busy'

export interface Availability {
  status: AvailabilityStatus
  note: string | null
  /** YYYY-AA-GG; bu günün sonuna kadar dolu. */
  until: string | null
}

export const AVAILABILITY_NOTE_MAX = 140
/** "Dolu" bitiş tarihi en fazla bu kadar gün ileri olabilir. */
export const AVAILABILITY_MAX_DAYS = 365

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  open: 'İş alıyorum',
  busy: 'Şu an dolu',
}

export const AVAILABILITY_COLUMNS = 'availability_status, availability_note, availability_until'

/** Türkiye saatiyle bugünün tarihi (YYYY-AA-GG). */
export function istanbulToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Satırdaki değerden geçerli durum: bitiş tarihi geçmiş "dolu" = "iş alıyorum". */
export function effectiveAvailability(row: { availability_status?: string | null; availability_note?: string | null; availability_until?: string | null } | null | undefined): Availability {
  if (!row || row.availability_status !== 'busy') return { status: 'open', note: null, until: null }
  const until = row.availability_until ?? null
  if (until && until < istanbulToday()) return { status: 'open', note: null, until: null }
  return { status: 'busy', note: row.availability_note ?? null, until }
}

export function formatAvailabilityUntil(until: string | null): string | null {
  if (!until) return null
  const d = new Date(`${until}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Kısa açıklama: "Şu an dolu · 20 Ekim 2026'ya kadar". */
export function availabilityText(a: Availability): string {
  if (a.status === 'open') return AVAILABILITY_LABELS.open
  const until = formatAvailabilityUntil(a.until)
  return until ? `${AVAILABILITY_LABELS.busy} · ${until} tarihine kadar` : AVAILABILITY_LABELS.busy
}

/** Teklif penceresindeki uyarı (teklif yine gönderilebilir). */
export function busyOfferWarning(a: Availability, name?: string | null): string | null {
  if (a.status !== 'busy') return null
  const who = name?.trim() || 'Bu profil'
  const until = formatAvailabilityUntil(a.until)
  return `${who} şu an yeni iş almadığını belirtti${until ? ` (${until} tarihine kadar)` : ''}. Teklif yine gönderilebilir ama yanıt gecikebilir.`
}

/** Dolu profilleri sona alan kararlı sıralama (keşif, öneriler). Yeni dizi döner. */
export function busyLast<T>(items: T[], isBusy: (item: T) => boolean): T[] {
  const open: T[] = []
  const busy: T[] = []
  for (const item of items) (isBusy(item) ? busy : open).push(item)
  return open.concat(busy)
}
