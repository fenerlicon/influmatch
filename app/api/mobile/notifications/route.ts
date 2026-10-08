import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { markNotificationsReadAs } from '@/lib/notification-reads'

export const dynamic = 'force-dynamic'

/** Bildirimleri okundu işaretler (web ile aynı kod). Gövde: { ids?: string[] } — ids yoksa tümü. */
export async function PATCH(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Yetkisiz erişim.' }, 401)

  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : undefined
  const result = await markNotificationsReadAs(ctx.supabase, ctx.user.id, ids)
  return mobileJson(result, result.success ? 200 : 400)
}
