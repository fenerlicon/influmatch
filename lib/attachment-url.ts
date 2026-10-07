// Geri bildirim ve destek talebi ekleri istemcide feedback-images kovasının köküne
// `feedback-<uuid>.<uzantı>` / `support-ticket-<uuid>.<uzantı>` adıyla yüklenir; sunucuya yalnızca adres gelir.
// Sunucu bu biçimin dışındaki adresi (başka site, başka kova, alt klasör) kaydetmez.

const ATTACHMENT_NAME = /^(feedback|support-ticket)-[0-9a-f-]{36}\.[a-z0-9]{1,32}$/i

export function isAllowedAttachmentUrl(url: string | null | undefined): boolean {
  if (url === null || url === undefined || url === '') return true
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  if (!base) return false
  const prefix = `${base}/storage/v1/object/public/feedback-images/`
  if (!url.startsWith(prefix)) return false
  return ATTACHMENT_NAME.test(url.slice(prefix.length))
}
