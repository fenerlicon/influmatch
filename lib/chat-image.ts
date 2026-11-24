// Sohbette görsel mesajlar `![image](<url>)` olarak saklanır. Yalnızca bizim chat-attachments
// deposundaki adresler görsel sayılır; elle yazılmış başka bir adres (başka site, javascript:)
// düz metin olarak gösterilir. Aksi halde next/image izinsiz adreste hata fırlatıp sohbeti
// çökertiyor ve bağlantı olarak tıklanabiliyordu.
//
// Kova gizlidir (20261008000004): mesajda eski biçimli "public" adres saklanır, gösterimde bu adresten
// dosya yolu çıkarılıp oda katılımcısına süreli imzalı bağlantı üretilir (chatAttachmentPath).
//
// R2 (2026-11-24): yeni görseller Cloudflare R2'de; mesajda `![image](r2://chat/{oda}/{gönderen}/{dosya})` saklanır.
// Gösterimde oda katılımcısına sunucu imzalı bağlantı üretir (lib/chat-attachments.ts). R2 ayarlı değilse eski yol sürer.
// Sohbette sıkıştırılmış önizleme görünür; tam boy dosya ayrıca saklanır ve "İndir" ile alınır (2026-11-24 kararı):
// `![image](r2://chat/{oda}/{gönderen}/{ad}.webp?full=jpg)` → tam boy anahtar `chat/{oda}/{gönderen}/{ad}_full.jpg`.
// Görsel kalıcıdır; yalnızca erişim bağlantısı kısa ömürlü ve istemci süresi dolunca kendiliğinden yeniler.

import { R2_REF_PREFIX, parseR2Ref } from '@/lib/r2-shared'

/** Sohbet görseli üst sınırı (web, mobil ve sunucu aynı). */
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** Tam boy (orijinal) görsel üst sınırı. Aşarsa yalnızca önizleme gönderilir. */
export const CHAT_FULL_IMAGE_MAX_BYTES = 20 * 1024 * 1024
export const CHAT_FULL_EXTENSIONS = ['jpg', 'png', 'webp'] as const

const CHAT_ATTACHMENT_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/chat-attachments/`

export function parseChatImageUrl(content: string): string | null {
  if (!content.startsWith('![image](') || !content.endsWith(')')) return null
  const url = content.slice(9, -1)
  if (/[\s()"'<>]/.test(url)) return null
  if (url.startsWith(R2_REF_PREFIX)) return chatAttachmentR2Key(url) ? url : null
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !url.startsWith(CHAT_ATTACHMENT_PREFIX)) return null
  return url
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const CHAT_R2_KEY = new RegExp(`^chat/(${UUID})/(${UUID})/[a-z0-9_]+\\.(webp|jpg|png)$`, 'i')

function splitFull(url: string): { base: string; full: string | null } | null {
  const i = url.indexOf('?full=')
  if (i < 0) return { base: url, full: null }
  const full = url.slice(i + 6).toLowerCase()
  if (!(CHAT_FULL_EXTENSIONS as readonly string[]).includes(full)) return null
  return { base: url.slice(0, i), full }
}

/** Mesajdaki `r2://chat/{oda}/{gönderen}/{dosya}` referansından önizleme R2 anahtarı; biçim tutmazsa null. */
export function chatAttachmentR2Key(url: string): string | null {
  const parts = splitFull(url)
  if (!parts) return null
  const key = parseR2Ref(parts.base)
  return key && CHAT_R2_KEY.test(key) ? key : null
}

/** Tam boy dosyanın R2 anahtarı (mesajda `?full=uzantı` varsa); yoksa null. */
export function chatAttachmentFullKey(url: string): string | null {
  const parts = splitFull(url)
  const key = chatAttachmentR2Key(url)
  if (!parts?.full || !key) return null
  return `${key.replace(/\.(webp|jpg|png)$/i, '')}_full.${parts.full}`
}

/** R2 sohbet anahtarındaki oda ve gönderen. */
export function chatR2KeyParts(key: string): { roomId: string; senderId: string } | null {
  const m = key.match(CHAT_R2_KEY)
  return m ? { roomId: m[1].toLowerCase(), senderId: m[2].toLowerCase() } : null
}

/** Mesajdaki ek adresinden kova içi yolu (`{oda}/{gönderen}/{dosya}`) çıkarır. */
export function chatAttachmentPath(url: string): string | null {
  if (!url.startsWith(CHAT_ATTACHMENT_PREFIX)) return null
  const path = decodeURIComponent(url.slice(CHAT_ATTACHMENT_PREFIX.length).split('?')[0])
  if (!path || path.includes('..') || path.split('/').length !== 3) return null
  return path
}

/** Kova içi yoldan mesajda saklanan adres (web ile aynı "public" biçim; gösterimde imzalı bağlantıya çevrilir). */
export function chatAttachmentUrl(path: string): string {
  return `${CHAT_ATTACHMENT_PREFIX}${path}`
}
