// Sohbette görsel mesajlar `![image](<url>)` olarak saklanır. Yalnızca bizim chat-attachments
// deposundaki adresler görsel sayılır; elle yazılmış başka bir adres (başka site, javascript:)
// düz metin olarak gösterilir. Aksi halde next/image izinsiz adreste hata fırlatıp sohbeti
// çökertiyor ve bağlantı olarak tıklanabiliyordu.
//
// Kova gizlidir (20261008000004): mesajda eski biçimli "public" adres saklanır, gösterimde bu adresten
// dosya yolu çıkarılıp oda katılımcısına süreli imzalı bağlantı üretilir (chatAttachmentPath).

const CHAT_ATTACHMENT_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/chat-attachments/`

export function parseChatImageUrl(content: string): string | null {
  if (!content.startsWith('![image](') || !content.endsWith(')')) return null
  const url = content.slice(9, -1)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !url.startsWith(CHAT_ATTACHMENT_PREFIX)) return null
  if (/[\s()"'<>]/.test(url)) return null
  return url
}

/** Mesajdaki ek adresinden kova içi yolu (`{oda}/{gönderen}/{dosya}`) çıkarır. */
export function chatAttachmentPath(url: string): string | null {
  if (!url.startsWith(CHAT_ATTACHMENT_PREFIX)) return null
  const path = decodeURIComponent(url.slice(CHAT_ATTACHMENT_PREFIX.length).split('?')[0])
  if (!path || path.includes('..') || path.split('/').length !== 3) return null
  return path
}
