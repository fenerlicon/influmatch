import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getOwnAvailability, setAvailabilityAs } from '@/lib/availability'

export const dynamic = 'force-dynamic'

/** Kendi müsaitliğim (3.19): { availability: { status: 'open'|'busy', note, until } }. */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  return mobileJson({ availability: await getOwnAvailability(ctx.supabase, ctx.user.id) })
}

/** Müsaitliği kaydeder (yalnızca influencer/UGC). Gövde: { status: 'open'|'busy', note?, until? (YYYY-AA-GG) } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result = await setAvailabilityAs(ctx.supabase, ctx.user.id, body)
  return mobileJson(result, 'error' in result ? 400 : 200)
}
