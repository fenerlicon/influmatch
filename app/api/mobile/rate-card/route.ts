import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getOwnRateCard, getVisibleRateCard, saveRateCardAs } from '@/lib/rate-card'

export const dynamic = 'force-dynamic'

/**
 * Fiyat kartı. ?userId= verilmezse kullanıcının kendi kartı; verilirse o influencer'ın kartı
 * (RLS: yalnızca doğrulanmış marka ve admin görür, diğerlerine null döner).
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const userId = new URL(request.url).searchParams.get('userId')
  if (userId && !/^[0-9a-f-]{36}$/i.test(userId)) return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const rateCard = !userId || userId === ctx.user.id ? await getOwnRateCard(ctx.supabase, ctx.user.id) : await getVisibleRateCard(ctx.supabase, userId)
  return mobileJson({ rateCard })
}

/** Influencer kendi kartını kaydeder. Gövde: { prices: { story?, reel?, post?, ugc_video?, package? }, negotiable } */
export async function PUT(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result = await saveRateCardAs(ctx.supabase, ctx.user.id, { prices: body.prices, negotiable: body.negotiable })
  return mobileJson(result, result.success ? 200 : 400)
}
