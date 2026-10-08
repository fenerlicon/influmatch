import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { sendMessageAs } from '@/lib/messages'

export const dynamic = 'force-dynamic'

/** Mesaj gönderir. Gövde: { roomId, content } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body?.roomId || typeof body.content !== 'string') {
    return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)
  }

  const result = await sendMessageAs(ctx.supabase, ctx.user.id, String(body.roomId), body.content)
  return mobileJson(result, result.success ? 200 : 400)
}
