import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createChatUploadUrlAs } from '@/lib/chat-upload'

export const dynamic = 'force-dynamic'

/**
 * Sohbet görseli için imzalı yükleme adresi. Gövde: { roomId, extension: 'jpg' | 'webp' | 'png' }
 * → { path, token, url, contentType }. Uygulama dosyayı uploadToSignedUrl ile yükler, sonra
 * POST /api/mobile/messages ile "![image](url)" gönderir (web ile aynı biçim).
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body?.roomId || typeof body.extension !== 'string') return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)
  const result = await createChatUploadUrlAs(ctx.supabase, ctx.user.id, String(body.roomId), body.extension)
  return mobileJson(result, result.success ? 200 : 400)
}
