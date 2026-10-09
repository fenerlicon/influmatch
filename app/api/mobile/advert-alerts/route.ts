import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createAdvertAlertAs, deleteAdvertAlertAs, listAdvertAlertsAs } from '@/lib/advert-alerts'

export const dynamic = 'force-dynamic'

/** Influencer'ın ilan alarmları: { alerts }. */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const result = await listAdvertAlertsAs(ctx.supabase, ctx.user.id)
  return mobileJson(result, result.success ? 200 : 403)
}

/** Alarm kurar. Gövde: { category?, platform?, minBudget? } (en fazla 5 alarm). */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result = await createAdvertAlertAs(ctx.supabase, ctx.user.id, {
    category: body.category,
    platform: body.platform,
    minBudget: body.minBudget,
  })
  return mobileJson(result, result.success ? 200 : 400)
}

/** Alarm siler: ?id= */
export async function DELETE(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const id = new URL(request.url).searchParams.get('id') ?? ''
  const result = await deleteAdvertAlertAs(ctx.supabase, ctx.user.id, id)
  return mobileJson(result, result.success ? 200 : 400)
}
