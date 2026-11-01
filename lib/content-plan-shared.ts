import type { ChipTone } from '@/components/ui'

// İçerik planı (/toplanti): istemci ve sunucunun ortak türleri ve tarih yardımcıları.
// Tarihler veritabanındaki gibi düz metin (YYYY-AA-GG) tutulur; saat dilimi kayması olmasın diye Date yalnızca UTC ile kullanılır.

// Sayfaya yalnızca bu hesap girer (Damla Dalay, 2026-11-01); menüdeki Toplantı maddesi de bu hesapta görünür.
export const CONTENT_PLAN_OWNER_ID = '15968172-2612-4f4b-bc15-77ee4178cc4c'

export const CONTENT_COVER_BUCKET = 'content-covers'
export const CONTENT_COVER_MAX_BYTES = 5 * 1024 * 1024
export const CONTENT_COVER_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export const CONTENT_STATUSES = ['idea', 'planned', 'shooting', 'editing', 'ready', 'published'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const STATUS_META: Record<ContentStatus, { label: string; tone: ChipTone }> = {
  idea: { label: 'Fikir', tone: 'neutral' },
  planned: { label: 'Planlandı', tone: 'info' },
  shooting: { label: 'Çekimde', tone: 'warning' },
  editing: { label: 'Kurguda', tone: 'warning' },
  ready: { label: 'Hazır', tone: 'gold' },
  published: { label: 'Paylaşıldı', tone: 'success' },
}

export interface ContentSeries {
  id: string
  title: string
  description: string | null
  planned_count: number | null
  start_date: string | null
  created_at: string
}

export interface ContentItem {
  id: string
  series_id: string | null
  episode_no: number | null
  title: string
  status: ContentStatus
  publish_date: string | null
  publish_time: string | null
  shoot_date: string | null
  script: string | null
  caption: string | null
  notes: string | null
  video_url: string | null
  cover_path: string | null
  /** Süreli imzalı bağlantı; sunucu plan yüklenirken üretir. */
  cover_url: string | null
  created_at: string
}

export interface ContentItemInput {
  title?: unknown
  series_id?: unknown
  episode_no?: unknown
  status?: unknown
  publish_date?: unknown
  publish_time?: unknown
  shoot_date?: unknown
  script?: unknown
  caption?: unknown
  notes?: unknown
  video_url?: unknown
  /** Verilmezse kapak değişmez; null kaldırır. */
  cover_path?: unknown
}

export interface ContentSeriesInput {
  title?: unknown
  description?: unknown
  planned_count?: unknown
  start_date?: unknown
}

export type ContentPlanResult = { success: true; message?: string } | { success: false; error: string }

/** Bugünün tarihi (İstanbul); sunucu ve tarayıcıda aynı sonucu verir. */
export function todayIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export function formatDate(date: string, withWeekday = false): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(withWeekday ? { weekday: 'short' as const } : {}),
  }).format(new Date(`${date}T00:00:00Z`))
}

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`))
}

export function shiftMonth(month: string, delta: number): string {
  const parsed = new Date(`${month}-01T00:00:00Z`)
  parsed.setUTCMonth(parsed.getUTCMonth() + delta)
  return parsed.toISOString().slice(0, 7)
}

/** Ay görünümünün günleri: pazartesiden başlar, ay dışı günlerle tam haftaya tamamlanır. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const start = addDays(first, -offset)
  const nextMonthFirst = `${shiftMonth(month, 1)}-01`
  const days: string[] = []
  for (let day = start; day < nextMonthFirst || days.length % 7 !== 0; day = addDays(day, 1)) days.push(day)
  return days
}

/** Tarihe göre sıralama: erken olan önce, tarihsizler sonda. */
export function compareByPublish(a: ContentItem, b: ContentItem): number {
  if (a.publish_date !== b.publish_date) {
    if (!a.publish_date) return 1
    if (!b.publish_date) return -1
    return a.publish_date < b.publish_date ? -1 : 1
  }
  return (a.publish_time ?? '').localeCompare(b.publish_time ?? '') || a.created_at.localeCompare(b.created_at)
}
