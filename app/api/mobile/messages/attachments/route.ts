import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { chatAttachmentDownloadAs, signChatAttachmentsAs } from '@/lib/chat-attachments'

export const dynamic = 'force-dynamic'

/**
 * R2'deki sohbet görselleri (2026-11-24). Yalnızca odanın tarafları.
 * - { refs: ['r2://chat/...'] } → { success: true, urls: { [ref]: önizlemeAdresi } } (12 saat; süresi dolunca yeniden istenir)
 * - { action: 'download', ref } → { success: true, url } tam boy dosya (yoksa önizleme), 10 dakika
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (body?.action === 'download') {
    const result = await chatAttachmentDownloadAs(ctx.supabase, ctx.user.id, body.ref)
    return mobileJson(result, result.success ? 200 : 400)
  }
  const urls = await signChatAttachmentsAs(ctx.supabase, ctx.user.id, body?.refs)
  return mobileJson({ success: true, urls })
}
