import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createSupportTicketAs } from '@/lib/support'

export const dynamic = 'force-dynamic'

/** Destek talebi (web ile aynı kod, lib/support.ts). Gövde: { subject, priority, message, fileUrl? } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum açmanız gerekiyor' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)

  const result = await createSupportTicketAs(ctx.supabase, ctx.user.id, {
    subject: body.subject,
    priority: body.priority,
    message: typeof body.message === 'string' ? body.message : '',
    fileUrl: typeof body.fileUrl === 'string' ? body.fileUrl : null,
  })
  return mobileJson(result, result.success ? 200 : 400)
}
