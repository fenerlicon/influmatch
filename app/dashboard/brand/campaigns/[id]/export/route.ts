import { createSupabaseServerClient } from '@/utils/supabase/server'
import { campaignCsvFilename, campaignDashboardCsv, getCampaignDashboardAs } from '@/lib/campaigns'

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

  const filename = campaignCsvFilename(result.dashboard.campaign)
  return new Response(campaignDashboardCsv(result.dashboard), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
