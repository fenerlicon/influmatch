import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { submitFeedbackAs } from '@/lib/feedback'

export const dynamic = 'force-dynamic'

/** Geri bildirim (web ile aynı kod, lib/feedback.ts). Gövde: { description, imageUrl? } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum bulunamadı. Lütfen yeniden giriş yapın.' }, 401)

  const body = await request.json().catch(() => null)
  const result = await submitFeedbackAs(ctx.supabase, ctx.user.id, {
    description: typeof body?.description === 'string' ? body.description : '',
    imageUrl: typeof body?.imageUrl === 'string' ? body.imageUrl : null,
  })
  return result.error
    ? mobileJson({ success: false, error: result.error }, 400)
    : mobileJson({ success: true })
}
