import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ButtonLink } from '@/components/ui'
import CampaignResultsLockedCard from '@/components/campaigns/CampaignResultsLockedCard'
import CampaignResultsTable from '@/components/campaigns/CampaignResultsTable'
import PrintButton from '@/components/campaigns/PrintButton'
import { formatCampaignDate } from '@/components/campaigns/campaign-ui'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { CAMPAIGN_NOT_FOUND, campaignFeaturesFor, formatTryAmount, getCampaignDashboardAs, targetSummary } from '@/lib/campaigns'
import { buildCampaignResults } from '@/lib/post-metrics'
import { COST_NOTE, METRICS_SOURCE_NOTE } from '@/lib/post-metrics-shared'

export const revalidate = 0

// Yazdırma: yalnızca rapor alanı, açık zemin. Tarayıcının "PDF olarak kaydet" seçeneğiyle PDF alınır (dış servis yok).
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 12mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #campaign-report, #campaign-report * { visibility: visible !important; }
  #campaign-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; border: 0 !important; }
  #campaign-report tr { break-inside: avoid; }
  .report-no-print { display: none !important; }
}
`

/** Yazdırılabilir kampanya sonuç raporu (3.20). Yalnızca kampanyanın sahibi; bayrak açıkken yalnızca Spotlight Pro. */
export default async function CampaignReportPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await getCampaignDashboardAs(supabase, user.id, params.id)
  if (!result.success) {
    if (result.error === CAMPAIGN_NOT_FOUND) notFound()
    return <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{result.error}</p>
  }
  const { campaign, summary } = result.dashboard
  const back = (
    <ButtonLink href={`/dashboard/brand/campaigns/${campaign.id}`} variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2">
      Kampanyaya dön
    </ButtonLink>
  )

  const features = await campaignFeaturesFor(user.id)
  if (!features.results) {
    return (
      <div className="space-y-4">
        {back}
        <CampaignResultsLockedCard />
      </div>
    )
  }

  const results = await buildCampaignResults(supabase, result.dashboard)
  const start = formatCampaignDate(campaign.start_date)
  const end = formatCampaignDate(campaign.end_date)
  const target = targetSummary(campaign)
  const generated = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="report-no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        {back}
        <PrintButton />
      </div>

      <article id="campaign-report" className="rounded-2xl border border-gray-200 bg-white p-6 text-black md:p-8">
        <header className="border-b border-gray-300 pb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gray-600">Influmatch · Kampanya sonuç raporu</p>
          <h1 className="mt-1 text-2xl font-semibold">{campaign.name}</h1>
          <p className="mt-1 text-sm text-gray-700">
            {[target, start || end ? `${start ?? '—'} – ${end ?? '—'}` : null, summary.total_budget !== null ? `Toplam bütçe: ${formatTryAmount(summary.total_budget)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Oluşturulma: {generated}
            {results.summary.last_captured_at
              ? ` · Son ölçüm: ${new Date(results.summary.last_captured_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </p>
        </header>

        <section className="mt-5">
          {results.summary.posts_live === 0 ? (
            <p className="text-sm text-gray-700">Bu kampanyada henüz yayın linki girilmiş gönderi yok.</p>
          ) : (
            <CampaignResultsTable results={results} print />
          )}
        </section>

        <footer className="mt-5 space-y-1 border-t border-gray-300 pt-3 text-xs text-gray-600">
          <p>{METRICS_SOURCE_NOTE}</p>
          <p>{COST_NOTE}</p>
          <p>
            Anlaşılan nakit ücretler: {formatTryAmount(summary.committed)} · {summary.collaborations} iş birliği · {summary.completed} tamamlandı
          </p>
        </footer>
      </article>
    </div>
  )
}
