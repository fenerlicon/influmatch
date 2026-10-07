// Sohbette görsel mesajlar `![image](<url>)` olarak saklanır. Yalnızca bizim chat-attachments
// deposundaki adresler görsel sayılır; elle yazılmış başka bir adres (başka site, javascript:)
// düz metin olarak gösterilir. Aksi halde next/image izinsiz adreste hata fırlatıp sohbeti
// çökertiyor ve bağlantı olarak tıklanabiliyordu.

const CHAT_ATTACHMENT_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/chat-attachments/`

export function parseChatImageUrl(content: string): string | null {
  if (!content.startsWith('![image](') || !content.endsWith(')')) return null
  const url = content.slice(9, -1)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !url.startsWith(CHAT_ATTACHMENT_PREFIX)) return null
  if (/[\s()"'<>]/.test(url)) return null
  return url
}
