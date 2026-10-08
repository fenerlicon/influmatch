import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { respondToOfferAs, type OfferResponse } from '@/lib/offers'

export const dynamic = 'force-dynamic'

/** Influencer teklife yanıt verir. Gövde: { response: 'accepted' | 'rejected' | 'hold' } */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  const response = body?.response as OfferResponse | undefined
  if (!response) return mobileJson({ error: 'Yanıt gerekli.' }, 400)

  const result = await respondToOfferAs(ctx.supabase, ctx.user.id, params.id, response)
  return mobileJson(result, 'error' in result ? 400 : 200)
}
