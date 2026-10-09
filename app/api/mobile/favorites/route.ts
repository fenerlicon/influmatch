import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { listFavoriteIdsAs, toggleFavoriteAs } from '@/lib/favorites'

export const dynamic = 'force-dynamic'

// Mobil favoriler (web ile aynı kod: lib/favorites.ts). Ücretsiz markada (sınırlar açıkken) kilitli.

/** { locked, ids }: markanın favori profil kimlikleri; kilitliyse ids boş. */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  try {
    return mobileJson(await listFavoriteIdsAs(ctx.supabase, ctx.user.id))
  } catch (error) {
    console.error('[mobile/favorites] okunamadı:', error)
    return mobileJson({ error: 'Favoriler alınamadı.' }, 500)
  }
}

/** Gövde { influencerId }: favoriye ekler ya da çıkarır → { isFavorited }. */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = (await request.json().catch(() => null)) as { influencerId?: unknown } | null
  const influencerId = typeof body?.influencerId === 'string' ? body.influencerId : ''
  const result = await toggleFavoriteAs(ctx.supabase, ctx.user.id, influencerId)
  if (result.error !== undefined) return mobileJson({ error: result.error }, 400)
  return mobileJson({ isFavorited: result.isFavorited })
}
