import Link from 'next/link'
import { Send } from 'lucide-react'
import OffersManager, { type OfferListItem } from '@/components/dashboard/OffersManager'
import BrandOffersList from '@/components/dashboard/BrandOffersList'
import CollaborationsManager from '@/components/dashboard/CollaborationsManager'
import { ButtonLink, PageHeader, Segmented } from '@/components/ui'
import type { CollaborationListItem } from '@/lib/collaborations'
import type { CollaborationStageRef } from '@/lib/collaboration-shared'
import { worksHref, type BrandOfferItem, type WorkCounts, type WorkStage } from '@/lib/works'
import { cn } from '@/utils/cn'

type Props = {
  userId: string
  stage: WorkStage
  counts: WorkCounts
  collaborations: CollaborationListItem[]
  collabError?: string | null
} & (
  | {
      role: 'influencer'
      offers: OfferListItem[]
      dismissedOfferIds: Set<string>
      /** Teklif gönderen markaların güvenilirliği (3.18-S4). */
      brandReliability?: Record<string, { completed: number; confirmed: number }>
    }
  | { role: 'brand'; offers: BrandOfferItem[]; dismissedReceiverIds: string[] }
)

const IN_FLIGHT: WorkStage[] = ['agreed', 'in_progress', 'published']

/** İşler sayfasının görünümü (veri app/dashboard/works/page.tsx'te yüklenir). */
export default function WorksView(props: Props) {
  const { role, userId, stage, counts, collaborations, collabError } = props
  // Kabul edilen teklifin iş birliği aşaması (3.14-S1); iş birlikleri zaten yüklü, ek sorgu yok.
  const collaborationByOffer: Record<string, CollaborationStageRef> = {}
  collaborations.forEach((c) => {
    if (c.offer_id) collaborationByOffer[c.offer_id] = { id: c.id, status: c.status }
  })

  const pipeline: Array<{ stage: WorkStage; label: string; count: number; hint: string }> = [
    { stage: 'offers', label: 'Teklif', count: counts.offers, hint: role === 'influencer' ? 'Yanıtını bekliyor' : 'Yanıt bekleniyor' },
    { stage: 'agreed', label: 'Anlaşıldı', count: counts.agreed, hint: 'Özet ve başlangıç' },
    { stage: 'in_progress', label: 'İçerik', count: counts.in_progress, hint: 'Hazırlanıyor' },
    { stage: 'published', label: 'Yayında', count: counts.published, hint: role === 'brand' ? 'Onayın bekleniyor' : 'Marka onayı bekleniyor' },
    { stage: 'done', label: 'Tamamlandı', count: counts.completed, hint: 'Geçmiş işler' },
  ]

  const isCollabStage = stage !== 'offers'
  const filterItems = [
    { value: 'active', label: 'Süren işler', href: worksHref('active') },
    { value: 'done', label: 'Tamamlanan ve iptal', href: worksHref('done') },
  ]
  const single = IN_FLIGHT.includes(stage) ? pipeline.find((p) => p.stage === stage) : null
  if (single) filterItems.splice(1, 0, { value: stage, label: single.label, href: worksHref(stage) })

  return (
    <div>
      <PageHeader
        title="İşler"
        description={role === 'brand' ? 'Teklif gönderdiğin andan ödeme teyidine kadar her iş burada.' : 'Gelen tekliflerden tamamlanan işlere kadar her şey burada.'}
        actions={
          role === 'brand' ? (
            <ButtonLink href="/dashboard/brand/discover" variant="primary" leftIcon={<Send />}>
              Yeni teklif
            </ButtonLink>
          ) : (
            <ButtonLink href="/dashboard/influencer/advert">İlanlara göz at</ButtonLink>
          )
        }
      />

      {/* Aşama kartları: dar ekranda yatay kayar */}
      <nav aria-label="İş aşamaları" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
        {pipeline.map((p) => {
          const active = stage === p.stage || (stage === 'active' && IN_FLIGHT.includes(p.stage))
          return (
            <Link
              key={p.stage}
              href={worksHref(p.stage)}
              aria-current={stage === p.stage ? 'page' : undefined}
              className={cn(
                'min-w-[132px] flex-none rounded-xl border px-3.5 py-3 transition-colors sm:min-w-0',
                active ? 'border-gold/30 bg-gold/10' : 'border-line bg-surface-1 hover:border-line-strong',
              )}
            >
              <div className={cn('text-[11px] font-medium uppercase tracking-[0.14em]', active ? 'text-gold' : 'text-ink-faint')}>{p.label}</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{p.count}</div>
              <div className="truncate text-xs text-ink-faint">{p.hint}</div>
            </Link>
          )
        })}
      </nav>

      {isCollabStage && <Segmented label="İş filtresi" className="mb-4" value={stage} items={filterItems} />}

      {collabError && isCollabStage && <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{collabError}</div>}

      {stage === 'offers' ? (
        props.role === 'influencer' ? (
          <OffersManager
            initialOffers={props.offers}
            currentUserId={userId}
            dismissedOfferIds={props.dismissedOfferIds}
            collaborationByOffer={collaborationByOffer}
            brandReliability={props.brandReliability}
          />
        ) : (
          <BrandOffersList
            initialOffers={props.offers}
            currentUserId={userId}
            dismissedReceiverIds={props.dismissedReceiverIds}
            collaborationByOffer={collaborationByOffer}
          />
        )
      ) : (
        <CollaborationsManager initialItems={collaborations} currentUserId={userId} role={role} stage={stage} />
      )}
    </div>
  )
}
