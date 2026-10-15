import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Target } from 'lucide-react'
import { ButtonLink, Card, Chip, EmptyState, PageHeader } from '@/components/ui'
import { CAMPAIGN_STATUS_TONES, formatCampaignDate as formatDate } from '@/components/campaigns/campaign-ui'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { CAMPAIGN_STATUS_LABELS, formatTryAmount, listCampaignsAs, targetSummary } from '@/lib/campaigns'

export const revalidate = 0

// Kampanyalar listesi (3.19). Marka paneli kilidi (onaysız marka) brand/layout.tsx'te.
export default async function CampaignsPage({ searchParams }: { searchParams: { arsiv?: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await listCampaignsAs(supabase, user.id)
  const showArchived = searchParams.arsiv === '1'
  const all = result.success ? result.campaigns : []
  const campaigns = all.filter((c) => (showArchived ? c.status === 'archived' : c.status !== 'archived'))
  const archivedCount = all.filter((c) => c.status === 'archived').length

  return (
    <div>
      <PageHeader
        title="Kampanyalar"
        description="Brief, hedef ve bütçeyi bir kez yaz; profilleri davet et, teklif ve iş birliklerini tek tabloda izle."
        actions={
          <ButtonLink href="/dashboard/brand/campaigns/new" variant="primary" leftIcon={<Plus />}>
            Yeni kampanya
          </ButtonLink>
        }
      />

      {!result.success && <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{result.error}</p>}

      <div className="mb-3 flex items-center justify-end text-xs">
        {showArchived ? (
          <Link href="/dashboard/brand/campaigns" className="text-ink-muted hover:text-ink">
            Aktif kampanyalara dön
          </Link>
        ) : archivedCount > 0 ? (
          <Link href="/dashboard/brand/campaigns?arsiv=1" className="text-ink-muted hover:text-ink">
            Arşiv ({archivedCount})
          </Link>
        ) : null}
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title={showArchived ? 'Arşivde kampanya yok' : 'Henüz kampanya yok'}
            description={showArchived ? undefined : 'İlk kampanyanı oluştur: brief ve hedefi yaz, uygun profilleri davet et.'}
            action={
              showArchived ? undefined : (
                <ButtonLink href="/dashboard/brand/campaigns/new" variant="primary" size="sm" leftIcon={<Plus />}>
                  Kampanya oluştur
                </ButtonLink>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {campaigns.map((c) => {
            const start = formatDate(c.start_date)
            const end = formatDate(c.end_date)
            const target = targetSummary(c)
            return (
              <Link key={c.id} href={`/dashboard/brand/campaigns/${c.id}`} className="group">
                <Card className="flex h-full flex-col gap-3 p-4 transition-colors group-hover:border-line-strong">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 truncate text-[15px] font-semibold text-ink">{c.name}</h2>
                    <Chip tone={CAMPAIGN_STATUS_TONES[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</Chip>
                  </div>
                  {target && <p className="text-xs text-ink-faint">{target}</p>}
                  {(start || end) && (
                    <p className="text-xs text-ink-muted">
                      {start ?? '—'} – {end ?? '—'}
                    </p>
                  )}
                  <div className="mt-auto grid grid-cols-3 rounded-xl border border-line text-[13px]">
                    {[
                      ['Davet', String(c.invited_count)],
                      ['Kabul', String(c.accepted_count)],
                      ['Bütçe', c.total_budget !== null ? formatTryAmount(c.total_budget) : '—'],
                    ].map(([k, v], i) => (
                      <div key={k} className={i > 0 ? 'border-l border-line px-2.5 py-2' : 'px-2.5 py-2'}>
                        <div className="text-[11px] text-ink-faint">{k}</div>
                        <div className="mt-px truncate font-semibold tabular-nums text-ink">{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
