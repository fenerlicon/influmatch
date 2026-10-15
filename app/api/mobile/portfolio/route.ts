import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { fetchAccountRole } from '@/lib/viewer-role'
import {
  getBrandPortfolioSettingAs,
  getOwnPortfolioAs,
  setBrandPortfolioSettingAs,
  setPortfolioItemHiddenAs,
} from '@/lib/portfolio-results'

export const dynamic = 'force-dynamic'

/**
 * Portföy sonuçları (4.3-S7), web ile aynı kod (lib/portfolio-results.ts).
 * Influencer: { portfolio: { mode: 'owner', items, pro } } — kendi sonuçları, gizliler dahil.
 * Marka: { showBrandName } — "İş birliği sonuçlarımda markamın adı görünsün" (varsayılan kapalı).
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const role = await fetchAccountRole(ctx.supabase, ctx.user.id)
  const result =
    role === 'brand' ? await getBrandPortfolioSettingAs(ctx.supabase, ctx.user.id) : await getOwnPortfolioAs(ctx.supabase, ctx.user.id)
  return mobileJson(result, 'error' in result ? 400 : 200)
}

/** Gövde: influencer { collaborationId, hidden: boolean } | marka { showBrandName: boolean }. */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result =
    'showBrandName' in body
      ? await setBrandPortfolioSettingAs(ctx.supabase, ctx.user.id, body.showBrandName)
      : await setPortfolioItemHiddenAs(ctx.supabase, ctx.user.id, body.collaborationId, body.hidden)
  return mobileJson(result, 'error' in result ? 400 : 200)
}
