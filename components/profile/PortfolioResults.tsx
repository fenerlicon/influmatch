'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { buttonClasses } from '@/components/ui'
import { setPortfolioItemHidden } from '@/app/actions/portfolio'
import { engagementLabel, formatCount, formatPercent, METRIC_STATUS_LABELS, METRICS_SOURCE_NOTE } from '@/lib/post-metrics-shared'
import {
  PORTFOLIO_DESCRIPTION,
  PORTFOLIO_EMPTY_OWNER,
  PORTFOLIO_OWNER_NOTE,
  PORTFOLIO_PRO_NOTE,
  PORTFOLIO_TITLE,
  type PortfolioItem,
  type PortfolioView,
} from '@/lib/portfolio-results-shared'

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

/**
 * Profildeki "Sonuçlar" (portföyde iş birliği sonuçları, 4.3-S7). Veri sunucuda hazırlanır (lib/portfolio-results.ts):
 * başkalarına yalnızca Influencer Pro profilinde ve gizlenmemiş kayıtlar; sahibine hepsi + gizle / göster.
 */
export default function PortfolioResults({ view }: { view: PortfolioView }) {
  const owner = view.mode === 'owner'
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-semibold tracking-tight">{PORTFOLIO_TITLE}</h3>
        <p className="text-xs text-ink-faint">{PORTFOLIO_DESCRIPTION}</p>
      </div>

      {owner && !view.pro && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4 text-[13px] text-ink-muted">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" aria-hidden />
          <div>
            <p className="font-medium text-ink">Influencer Pro özelliği</p>
            <p className="mt-1">{PORTFOLIO_PRO_NOTE}</p>
            <Link href="/dashboard/spotlight/influencer" className="mt-2 inline-block text-xs font-medium text-gold hover:underline">
              Paketleri gör
            </Link>
          </div>
        </div>
      )}
      {owner && view.pro && <p className="mt-3 text-xs text-ink-faint">{PORTFOLIO_OWNER_NOTE}</p>}

      {view.items.length === 0 ? (
        <p className="mt-4 text-[13px] text-ink-muted">{PORTFOLIO_EMPTY_OWNER}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {view.items.map((item) => (
            <PortfolioCard key={item.collaboration_id} item={item} owner={owner} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-ink-faint">{METRICS_SOURCE_NOTE}</p>
    </section>
  )
}

function PortfolioCard({ item: initial, owner }: { item: PortfolioItem; owner: boolean }) {
  const [item, setItem] = useState(initial)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    const next = !item.hidden
    startTransition(async () => {
      const result = await setPortfolioItemHidden(item.collaboration_id, next)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setItem({ ...item, hidden: result.hidden })
      toast.success(result.hidden ? 'Portföyünden gizlendi.' : 'Portföyünde gösteriliyor.')
    })
  }

  const { totals } = item
  return (
    <li className={`rounded-xl border border-line bg-surface-2 p-4 ${item.hidden ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {item.brand.name_visible && item.brand.username ? (
              <Link href={`/profile/${item.brand.username}`} className="hover:text-gold">
                {item.brand.label}
              </Link>
            ) : (
              item.brand.label
            )}
            {item.brand.sector && <span className="ml-2 text-xs font-normal text-ink-faint">{item.brand.sector}</span>}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {item.kinds.join(', ')} · Yayın: {formatDate(item.published_at)}
          </p>
          {owner && !item.brand.name_visible && item.owner_brand_name && (
            <p className="mt-1 text-[11px] text-ink-faint">
              {item.owner_brand_name} adının görünmesine izin vermedi; başkalarına &quot;{item.brand.label}&quot; olarak görünür.
            </p>
          )}
        </div>
        {owner && (
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className={buttonClasses({ size: 'sm' })}
          >
            {pending ? 'Kaydediliyor…' : item.hidden ? 'Portföyde göster' : 'Portföyden gizle'}
          </button>
        )}
      </div>

      {totals.measured > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Metric label="İzlenme" value={formatCount(totals.views)} />
          <Metric label="Beğeni" value={formatCount(totals.likes)} />
          <Metric label="Yorum" value={formatCount(totals.comments)} />
          <Metric label={totals.engagement ? engagementLabel(totals.engagement.basis) : 'Etkileşim'} value={formatPercent(totals.engagement)} />
        </dl>
      )}

      <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
        {item.posts.map((post) => (
          <li key={post.deliverable_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-ink">{post.kind}</span>
            <span className="text-ink-faint">{formatDate(post.published_at)}</span>
            {post.latest ? (
              <span>
                {formatCount(post.latest.views)} izlenme · {formatCount(post.latest.likes)} beğeni · {formatCount(post.latest.comments)} yorum
                {post.engagement && ` · ${engagementLabel(post.engagement.basis)}: ${formatPercent(post.engagement)}`}
              </span>
            ) : (
              <span className="text-ink-faint">{post.status ? METRIC_STATUS_LABELS[post.status] : 'Ölçüm yok'}</span>
            )}
            {post.post_url && (
              <a href={post.post_url} target="_blank" rel="noreferrer noopener" className="text-gold hover:underline">
                Gönderiyi aç
              </a>
            )}
          </li>
        ))}
      </ul>
    </li>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-3 px-3 py-2">
      <dt className="text-[11px] text-ink-faint">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}
