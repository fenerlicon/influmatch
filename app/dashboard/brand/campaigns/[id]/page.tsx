import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Download, Pencil, UserPlus, Users } from 'lucide-react'
import { Avatar, ButtonLink, Card, CardHeader, Chip, EmptyState, PageHeader, StatCard } from '@/components/ui'
import CampaignBriefView from '@/components/campaigns/CampaignBriefView'
import CampaignLinks, { DetachOfferButton } from '@/components/campaigns/CampaignLinks'
import CampaignProLockedCard from '@/components/campaigns/CampaignProLockedCard'
import CampaignStatusControl from '@/components/campaigns/CampaignStatusControl'
import { CAMPAIGN_OFFER_STATUS_TONES, formatCampaignDate } from '@/components/campaigns/campaign-ui'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { COLLABORATION_STATUS_LABELS, type CollaborationStatus } from '@/lib/collaboration-shared'
import { COLLABORATION_TONES } from '@/lib/works'
import {
  CAMPAIGN_OFFER_STATUS_LABELS,
  CAMPAIGN_OPEN_STATUSES,
  campaignFeaturesFor,
  formatTryAmount,
  getCampaignDashboardAs,
  targetSummary,
} from '@/lib/campaigns'

export const revalidate = 0

// Kampanya panosu (3.19): bütün profiller tek tabloda, bütçe özeti, CSV dışa aktarma.
export default async function CampaignDashboardPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await getCampaignDashboardAs(supabase, user.id, params.id)
  if (!result.success) {
    if (result.error === 'Kampanya bulunamadı.') notFound()
    return <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{result.error}</p>
  }
  const { campaign, rows, summary, adverts } = result.dashboard
  const features = await campaignFeaturesFor(user.id)
  const open = CAMPAIGN_OPEN_STATUSES.includes(campaign.status)
  const target = targetSummary(campaign)
  const start = formatCampaignDate(campaign.start_date)
  const end = formatCampaignDate(campaign.end_date)
  const remaining = summary.total_budget !== null ? summary.total_budget - summary.committed : null

  return (
    <div>
      <ButtonLink href="/dashboard/brand/campaigns" variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2 mb-2">
        Kampanyalar
      </ButtonLink>
      <PageHeader
        title={campaign.name}
        description={[target, start || end ? `${start ?? '—'} – ${end ?? '—'}` : null].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <CampaignStatusControl campaignId={campaign.id} status={campaign.status} />
            {campaign.status !== 'archived' && (
              <ButtonLink href={`/dashboard/brand/campaigns/${campaign.id}/edit`} leftIcon={<Pencil />}>
                Düzenle
              </ButtonLink>
            )}
            <a href={`/dashboard/brand/campaigns/${campaign.id}/export`} className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-line-strong bg-surface-3 px-4 text-[13.5px] font-medium text-ink hover:border-white/20">
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </a>
            {open && features.suggestions && (
              <ButtonLink href={`/dashboard/brand/campaigns/${campaign.id}/invite`} variant="primary" leftIcon={<UserPlus />}>
                Profil davet et
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam bütçe" value={formatTryAmount(summary.total_budget)} detail={remaining !== null ? `Kalan: ${formatTryAmount(remaining)}` : 'Belirlenmedi'} />
        <StatCard label="Anlaşılan ücretler" value={formatTryAmount(summary.committed)} detail={`${summary.collaborations} iş birliği (nakit)`} />
        <StatCard label="Ödendi (teyitli)" value={formatTryAmount(summary.confirmed_paid)} detail={`Marka işaretli: ${formatTryAmount(summary.marked_paid)}`} />
        <StatCard
          label="Davetler"
          value={summary.invited}
          detail={`${summary.pending} bekliyor · ${summary.accepted} kabul · ${summary.declined} düşen · ${summary.completed} tamamlandı`}
        />
      </div>

      {open && !features.suggestions && (
        <div className="mb-5">
          <CampaignProLockedCard compact />
        </div>
      )}

      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Profiller" description="Teklif, iş birliği, teslimat ve ödeme durumu" />
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Bu kampanyada henüz profil yok"
            description={
              features.suggestions
                ? 'Önerilen profilleri davet et ya da mevcut tekliflerini kampanyaya bağla.'
                : 'Profil sayfasındaki teklif penceresinden bu kampanyayı seçerek ya da mevcut tekliflerini bağlayarak ekleyebilirsin.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Profil</th>
                  <th className="px-3 py-2.5 font-medium">Teklif</th>
                  <th className="px-3 py-2.5 font-medium">İş birliği</th>
                  <th className="px-3 py-2.5 font-medium">Teslimat</th>
                  <th className="px-3 py-2.5 font-medium">Ücret</th>
                  <th className="px-3 py-2.5 font-medium">Ödeme</th>
                  <th className="px-5 py-2.5 text-right font-medium">Eylem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const name = r.creator.full_name || (r.creator.username ? `@${r.creator.username}` : 'Profil')
                  return (
                    <tr key={r.key} className="align-middle hover:bg-white/[0.015]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={name} src={r.creator.avatar_url} size="sm" />
                          <div className="min-w-0">
                            {r.creator.username ? (
                              <Link href={`/profile/${r.creator.username}`} className="block truncate font-medium text-ink hover:underline">
                                {name}
                              </Link>
                            ) : (
                              <span className="block truncate font-medium text-ink">{name}</span>
                            )}
                            <span className="block truncate text-xs text-ink-faint">{r.source === 'offer' ? 'Teklif' : `İlan: ${r.advert_title ?? ''}`}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.offer_status ? (
                          <Chip tone={CAMPAIGN_OFFER_STATUS_TONES[r.offer_status]}>{CAMPAIGN_OFFER_STATUS_LABELS[r.offer_status]}</Chip>
                        ) : (
                          <Chip tone="success">Başvuru kabul</Chip>
                        )}
                        {r.offer_budget !== null && <div className="mt-1 text-xs tabular-nums text-ink-faint">{formatTryAmount(r.offer_budget)}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {r.collaboration_status ? (
                          <Chip tone={COLLABORATION_TONES[r.collaboration_status as CollaborationStatus]}>
                            {COLLABORATION_STATUS_LABELS[r.collaboration_status as CollaborationStatus]}
                          </Chip>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink-muted">
                        {r.collaboration_id ? (r.deliverables_total > 0 ? `${r.deliverables_published} / ${r.deliverables_total} yayında` : 'Teslimat yok') : '—'}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {r.agreed_fee !== null ? (
                          <>
                            <span className="text-ink">{formatTryAmount(r.agreed_fee)}</span>
                            <span className="ml-1 text-xs text-ink-faint">{r.payment_type === 'barter' ? 'barter' : 'nakit'}</span>
                            {!r.agreement_confirmed && <div className="text-xs text-warning">onay bekliyor</div>}
                          </>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {r.collaboration_id ? (
                          <div className="grid gap-0.5">
                            <span className={r.brand_paid ? 'text-ink' : 'text-ink-faint'}>{r.brand_paid ? '✓ Ödedin' : 'Ödeme işaretlenmedi'}</span>
                            <span className={r.influencer_confirmed ? 'text-success' : 'text-ink-faint'}>{r.influencer_confirmed ? '✓ Alındı teyidi' : 'Teyit yok'}</span>
                          </div>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.collaboration_id ? (
                            <ButtonLink size="sm" href={`/dashboard/collaborations/${r.collaboration_id}`}>
                              İş birliği
                            </ButtonLink>
                          ) : r.offer_id ? (
                            <ButtonLink size="sm" href="/dashboard/works?stage=offers">
                              Teklif
                            </ButtonLink>
                          ) : null}
                          {r.room_id && (
                            <ButtonLink size="sm" variant="ghost" href={`/dashboard/messages?roomId=${r.room_id}`}>
                              Sohbet
                            </ButtonLink>
                          )}
                          {r.offer_id && <DetachOfferButton campaignId={campaign.id} offerId={r.offer_id} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Brief" description="Davet edilenler bu bilgileri salt okunur görür." />
          <div className="p-5">
            <CampaignBriefView brief={campaign} title="Brief" />
          </div>
        </Card>
        <CampaignLinks campaignId={campaign.id} adverts={adverts} canAttach={open} />
      </div>
    </div>
  )
}
