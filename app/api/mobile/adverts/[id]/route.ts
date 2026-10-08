import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { deleteAdvertAs, updateAdvertStatusAs, type AdvertStatus } from '@/lib/adverts'

export const dynamic = 'force-dynamic'

/** İlan durumunu değiştirir. Gövde: { status: 'open' | 'paused' | 'closed' } */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  const result = await updateAdvertStatusAs(ctx.supabase, ctx.user.id, params.id, body?.status as AdvertStatus)
  return mobileJson(result, result.error ? 400 : 200)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const result = await deleteAdvertAs(ctx.supabase, ctx.user.id, params.id)
  return mobileJson(result, result.error ? 400 : 200)
}
