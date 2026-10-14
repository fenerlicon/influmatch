import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getOfferQuota, offerQuotaSummary } from '@/lib/brand-limits'
import {
  CAMPAIGN_NOT_FOUND,
  campaignFeaturesFor,
  getCampaignAs,
  getCampaignDashboardAs,
  inviteCreatorsAs,
  linkToCampaignAs,
  listAttachablesAs,
  saveCampaignAs,
  setCampaignStatusAs,
  suggestCampaignProfilesAs,
} from '@/lib/campaigns'

export const dynamic = 'force-dynamic'
// Toplu davet (en fazla 25 teklif, her biri bildirimle) sırayla gönderilir.
export const maxDuration = 60

const status = (error: string) => (error === CAMPAIGN_NOT_FOUND ? 404 : 400)

/**
 * Kampanya (3.19). Varsayılan: pano { dashboard, features, quotaText }. ?view=suggestions → { suggestions } (Pro kapısı),
 * ?view=attachables → { offers, adverts } (kampanyaya bağlanabilecek kendi kayıtları). Yalnızca kampanyanın sahibi marka.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const view = new URL(request.url).searchParams.get('view')

  if (view === 'suggestions') {
    const result = await suggestCampaignProfilesAs(ctx.supabase, ctx.user.id, params.id)
    return result.success ? mobileJson({ suggestions: result.suggestions }) : mobileJson({ error: result.error }, status(result.error))
  }
  if (view === 'attachables') {
    if (!(await getCampaignAs(ctx.supabase, ctx.user.id, params.id))) return mobileJson({ error: CAMPAIGN_NOT_FOUND }, 404)
    return mobileJson(await listAttachablesAs(ctx.supabase, ctx.user.id))
  }

  const result = await getCampaignDashboardAs(ctx.supabase, ctx.user.id, params.id)
  if (!result.success) return mobileJson({ error: result.error }, status(result.error))
  const [features, quota] = await Promise.all([campaignFeaturesFor(ctx.user.id), getOfferQuota(ctx.user.id).catch(() => null)])
  return mobileJson({ dashboard: result.dashboard, features, quotaText: offerQuotaSummary(quota) })
}

/** Kampanya bilgilerini günceller. Gövde: CampaignInput. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result = await saveCampaignAs(ctx.supabase, ctx.user.id, body, params.id)
  return result.success ? mobileJson(result) : mobileJson({ error: result.error }, status(result.error))
}

/**
 * İşlemler. Gövde:
 *  { action: 'status', status: 'draft'|'active'|'completed'|'archived' }
 *  { action: 'invite', creatorIds: string[], campaignType?, budget, paymentType?, message? } → { outcome }
 *  { action: 'link', kind: 'offer'|'advert', id, attach: boolean }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  let result: { success?: boolean; error?: string } & Record<string, unknown>
  switch (body.action) {
    case 'status':
      result = await setCampaignStatusAs(ctx.supabase, ctx.user.id, params.id, body.status)
      break
    case 'invite':
      result = await inviteCreatorsAs(ctx.supabase, ctx.user.id, params.id, body)
      break
    case 'link':
      result = await linkToCampaignAs(ctx.supabase, ctx.user.id, params.id, body)
      break
    default:
      return mobileJson({ error: 'Geçersiz işlem.' }, 400)
  }
  return result.error ? mobileJson({ error: result.error }, status(result.error)) : mobileJson(result)
}
