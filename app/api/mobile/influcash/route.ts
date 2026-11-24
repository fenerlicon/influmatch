import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getInflucashOverview, influcashChip, redeemItem } from '@/lib/influcash'

export const dynamic = 'force-dynamic'

/**
 * Influcash (2026-11-23). GET: { enabled, overview } (bakiye, geçmiş, katalog, alınan ödüller, kurallar). Özellik kapalıysa
 * { enabled: false } (ekran gizlenir). POST { itemId }: ödülü al (tek veritabanı işlemi; kurallar lib/influcash.ts).
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  // ?ozet=1: yalnızca { enabled, balance } (profil satırı / bakiye çipi).
  if (new URL(request.url).searchParams.get('ozet') === '1') {
    const balance = await influcashChip(ctx.user.id)
    return mobileJson(balance === null ? { enabled: false } : { enabled: true, balance })
  }
  const overview = await getInflucashOverview(ctx.user.id)
  return mobileJson(overview ? { enabled: true, overview } : { enabled: false })
}

export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = (await request.json().catch(() => null)) as { itemId?: unknown } | null
  const result = await redeemItem(ctx.user.id, body?.itemId)
  return mobileJson(result, result.success ? 200 : 400)
}
