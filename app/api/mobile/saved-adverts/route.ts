import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { listSavedAdvertIdsAs, setAdvertSavedAs } from '@/lib/advert-alerts'

export const dynamic = 'force-dynamic'

/** Kullanıcının kaydettiği ilan kimlikleri: { advertIds } (RLS: yalnızca kendi kayıtları). */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  return mobileJson({ advertIds: await listSavedAdvertIdsAs(ctx.supabase, ctx.user.id) })
}

/** İlanı kaydeder / kayıttan çıkarır. Gövde: { advertId, saved } . Yalnızca influencer. */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.advertId !== 'string') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result = await setAdvertSavedAs(ctx.supabase, ctx.user.id, body.advertId, body.saved === true)
  return mobileJson(result, result.success ? 200 : 400)
}
