import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { editOfferAs, withdrawOfferAs } from '@/lib/offers'

export const dynamic = 'force-dynamic'

/**
 * Marka bekleyen teklifini düzenler (2026-10-14). Gövde: { campaignName, campaignType?, budget?, message?, paymentType? }
 * Süre yeniden başlamaz, kotaya sayılmaz; kurallar ve bildirim lib/offers.ts (web ile aynı).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result = await editOfferAs(ctx.supabase, ctx.user.id, params.id, body)
  return mobileJson(result, 'error' in result ? 400 : 200)
}

/** Marka bekleyen teklifini geri çeker. Gövde: { action: 'withdraw' } */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (body?.action !== 'withdraw') return mobileJson({ error: 'Geçersiz işlem.' }, 400)
  const result = await withdrawOfferAs(ctx.supabase, ctx.user.id, params.id)
  return mobileJson(result, 'error' in result ? 400 : 200)
}
