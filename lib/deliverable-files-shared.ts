// Teslimat dosyası (taslak video / görsel) kuralları: web, mobil ve sunucu ortak (sunucu bağımlılığı yok). 2026-11-24.
// Dosyalar Cloudflare R2'de (lib/r2.ts); teslimatta `draft_url` alanında `r2://deliverables/{iş birliği}/{influencer}/{dosya}` saklanır.

import { R2_REF_PREFIX } from '@/lib/r2-shared'

export const DELIVERABLE_FILE_TYPES: Record<string, { contentType: string; kind: 'video' | 'image' }> = {
  mp4: { contentType: 'video/mp4', kind: 'video' },
  mov: { contentType: 'video/quicktime', kind: 'video' },
  webm: { contentType: 'video/webm', kind: 'video' },
  jpg: { contentType: 'image/jpeg', kind: 'image' },
  png: { contentType: 'image/png', kind: 'image' },
  webp: { contentType: 'image/webp', kind: 'image' },
}

/** Video en fazla 200 MB, görsel en fazla 15 MB (R2 alanı ve yükleme süresi için). */
export const DELIVERABLE_VIDEO_MAX_BYTES = 200 * 1024 * 1024
export const DELIVERABLE_IMAGE_MAX_BYTES = 15 * 1024 * 1024

export const DELIVERABLE_FILE_ACCEPT = 'video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp'

/** Dosya adından / MIME türünden uzantı (jpeg → jpg, quicktime → mov). Desteklenmiyorsa null. */
export function deliverableFileExtension(name: string, mime?: string | null): string | null {
  const byMime: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  if (mime && byMime[mime]) return byMime[mime]
  const ext = (name.split('.').pop() || '').toLowerCase()
  const normalized = ext === 'jpeg' ? 'jpg' : ext
  return DELIVERABLE_FILE_TYPES[normalized] ? normalized : null
}

export function deliverableFileMaxBytes(extension: string): number {
  return DELIVERABLE_FILE_TYPES[extension]?.kind === 'video' ? DELIVERABLE_VIDEO_MAX_BYTES : DELIVERABLE_IMAGE_MAX_BYTES
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const DELIVERABLE_KEY = new RegExp(`^deliverables/(${UUID})/(${UUID})/[a-z0-9_]+\\.(mp4|mov|webm|jpg|png|webp)$`, 'i')

/** `r2://deliverables/...` referansından anahtar ve parçaları; biçim tutmazsa null. */
export function parseDeliverableFileRef(value: string | null | undefined): { key: string; collaborationId: string; uploaderId: string; extension: string } | null {
  if (!value || !value.startsWith(R2_REF_PREFIX)) return null
  const key = value.slice(R2_REF_PREFIX.length)
  const m = key.match(DELIVERABLE_KEY)
  if (!m) return null
  return { key, collaborationId: m[1].toLowerCase(), uploaderId: m[2].toLowerCase(), extension: m[3].toLowerCase() }
}

export function isDeliverableFileRef(value: string | null | undefined): boolean {
  return parseDeliverableFileRef(value) !== null
}

/** Teslimat dosyasının türü (önizlemede video mu görsel mi). */
export function deliverableFileKind(value: string | null | undefined): 'video' | 'image' | null {
  const parsed = parseDeliverableFileRef(value)
  return parsed ? DELIVERABLE_FILE_TYPES[parsed.extension]?.kind ?? null : null
}

export const DELIVERABLE_LOCK_NOTE =
  'Marka dosyayı önizleyebilir; orijinal dosyayı indirmek, influencer "Ödeme alındı" işaretledikten sonra açılır.'
