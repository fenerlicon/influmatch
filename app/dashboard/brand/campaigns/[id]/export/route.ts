import { createSupabaseServerClient } from '@/utils/supabase/server'
import { campaignCsvFilename, campaignDashboardCsv, campaignFeaturesFor, getCampaignDashboardAs } from '@/lib/campaigns'
import { buildCampaignResults } from '@/lib/post-metrics'

export const dynamic = 'force-dynamic'

// Kampanya tablosu CSV (3.19). Yalnızca kampanyanın sahibi marka: okuma RLS'li oturum istemcisiyle ve brand_id eşleşmesiyle;
// başka markanın kampanyası "bulunamadı" döner. Satırlar yalnızca bu markanın kendi teklif / başvuru kayıtlarından gelir.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Oturum gerekli.', { status: 401 })

  const result = await getCampaignDashboardAs(supabase, user.id, params.id)
  if (!result.success) return new Response(result.error, { status: result.error === 'Kampanya bulunamadı.' ? 404 : 403 })

  // Ölçüm sütunları sonuç raporuyla aynı kapıda (bayrak açıkken yalnızca Spotlight Pro, 3.20).
  const results = (await campaignFeaturesFor(user.id)).results ? await buildCampaignResults(supabase, result.dashboard) : null
  const filename = campaignCsvFilename(result.dashboard.campaign)
  return new Response(campaignDashboardCsv(result.dashboard, results), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
