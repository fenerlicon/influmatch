import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createChatUploadUrlAs } from '@/lib/chat-upload'

export const dynamic = 'force-dynamic'

/**
 * Sohbet görseli için imzalı yükleme adresi. Gövde: { roomId, extension: 'jpg' | 'webp' | 'png', size?, full?: { extension, size } }
 * (`full`: tam boy orijinal; R2'de ayrıca saklanır, sohbette önizleme görünür, "İndir" tam boyu verir)
 * - R2 ayarlı ve `size` (bayt) gönderilmişse → { provider: 'r2', uploadUrl, url, contentType }: uygulama dosyayı uploadUrl'e
 *   PUT eder (Content-Type aynı, gövde tam `size` bayt).
 * - Değilse → { provider: 'supabase', path, token, url, contentType }: uploadToSignedUrl ile yüklenir.
 * Sonra POST /api/mobile/messages ile "![image](url)" gönderilir (web ile aynı biçim).
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body?.roomId || typeof body.extension !== 'string') return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)
  const size = body.size === undefined || body.size === null ? undefined : Number(body.size)
  const full =
    body.full && typeof body.full === 'object' && typeof body.full.extension === 'string'
      ? { extension: body.full.extension, size: Number(body.full.size) }
      : null
  const result = await createChatUploadUrlAs(ctx.supabase, ctx.user.id, String(body.roomId), body.extension, size, full)
  return mobileJson(result, result.success ? 200 : 400)
}
