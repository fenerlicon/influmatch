import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getEmailPreferences, saveEmailPreferences } from '@/lib/email-preferences'

export const dynamic = 'force-dynamic'

/** E-posta bildirim tercihleri (web ayarlarıyla aynı alan: users.email_notifications). */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const result = await getEmailPreferences(ctx.supabase, ctx.user.id)
  return 'error' in result ? mobileJson({ error: result.error }, 500) : mobileJson({ preferences: result.preferences })
}

/** Gövde: { preferences: { offers, advert_applications, messages, updates, marketing } } */
export async function PATCH(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body.preferences !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result = await saveEmailPreferences(ctx.supabase, ctx.user.id, body.preferences, 'mobile')
  return 'error' in result
    ? mobileJson({ success: false, error: result.error }, 400)
    : mobileJson({ success: true, preferences: result.preferences })
}
