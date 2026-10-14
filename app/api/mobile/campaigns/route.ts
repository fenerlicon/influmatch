import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { campaignFeaturesFor, listCampaignsAs, saveCampaignAs } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

/**
 * Markanın kampanyaları (3.19): { campaigns, features: { suggestions, bulkInvite } }. Yalnızca onaylı marka.
 * features: ücretsiz marka sınırları bayrağı açıkken öneriler ve toplu davet yalnızca Spotlight Pro'da.
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const result = await listCampaignsAs(ctx.supabase, ctx.user.id)
  if (!result.success) return mobileJson({ error: result.error }, 403)
  return mobileJson({ campaigns: result.campaigns, features: await campaignFeaturesFor(ctx.user.id) })
}

/** Kampanya oluşturur. Gövde: lib/campaigns-shared.ts CampaignInput (name, goal, ..., defaultDeliverables). */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result = await saveCampaignAs(ctx.supabase, ctx.user.id, body)
  return mobileJson(result, result.success ? 200 : 400)
}
