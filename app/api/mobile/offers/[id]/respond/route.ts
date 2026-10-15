import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { respondToOfferAs, type OfferResponse } from '@/lib/offers'

export const dynamic = 'force-dynamic'

/**
 * Influencer teklife yanıt verir. Gövde: { response: 'accepted' | 'rejected' | 'hold', seenEditedAt?: string | null }
 * seenEditedAt (ekrandaki teklifin edited_at değeri) gönderilirse marka o arada düzenlediyse kabul reddedilir.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  const response = body?.response as OfferResponse | undefined
  if (!response) return mobileJson({ error: 'Yanıt gerekli.' }, 400)
  const seenEditedAt =
    body && 'seenEditedAt' in body ? (typeof body.seenEditedAt === 'string' ? body.seenEditedAt : null) : undefined

  const result = await respondToOfferAs(ctx.supabase, ctx.user.id, params.id, response, { seenEditedAt })
  return mobileJson(result, 'error' in result ? 400 : 200)
}
