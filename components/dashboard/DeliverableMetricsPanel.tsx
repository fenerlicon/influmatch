'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { refreshMetricsAction } from '@/app/dashboard/collaborations/[id]/actions'
import {
  MANUAL_REFRESH_HOURS,
  METRIC_STAGE_LABELS,
  METRIC_STATUS_LABELS,
  engagementLabel,
  engagementOf,
  formatCount,
  formatPercent,
  type DeliverableMetrics,
} from '@/lib/post-metrics-shared'

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

/**
 * Yayınlanan teslimatın gönderi ölçümleri (sonuç raporu, 3.20): son ölçüm + kısa geçmiş. İki taraf da görür; "Şimdi güncelle"
 * yalnızca markada (6 saatte bir). Yalnızca ölçülen sayılar; kıyas yok.
 */
export default function DeliverableMetricsPanel({ collaborationId, metrics }: { collaborationId: string; metrics: DeliverableMetrics }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [, startTransition] = useTransition()
  const [historyOpen, setHistoryOpen] = useState(false)
  const { latest, engagement } = metrics

  const refresh = () => {
    setBusy(true)
    setMessage(null)
    startTransition(async () => {
      const result = await refreshMetricsAction(collaborationId, metrics.deliverable_id)
      setBusy(false)
      setMessage(result.success ? { type: 'success', text: result.message } : { type: 'error', text: result.error })
      if (result.success) router.refresh()
    })
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Sonuçlar</p>
        <p className="text-[11px] text-gray-500">
          {metrics.status === 'active' && metrics.next_stage
            ? `Sonraki ölçüm: ${METRIC_STAGE_LABELS[metrics.next_stage]} (${formatDateTime(metrics.next_due_at)})`
            : METRIC_STATUS_LABELS[metrics.status]}
        </p>
      </div>

      {latest ? (
        <>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Metric label="İzlenme" value={formatCount(latest.views)} />
            <Metric label="Beğeni" value={formatCount(latest.likes)} />
            <Metric label="Yorum" value={formatCount(latest.comments)} />
            <Metric label={engagement ? engagementLabel(engagement.basis) : 'Etkileşim'} value={formatPercent(engagement)} />
          </dl>
          <p className="mt-1 text-[11px] text-gray-500">
            Son ölçüm: {formatDateTime(latest.captured_at)} ({METRIC_STAGE_LABELS[latest.stage]})
            {engagement?.basis === 'followers' && metrics.followers_at_publish ? ` · Yayın anındaki takipçi: ${formatCount(metrics.followers_at_publish)}` : ''}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-gray-400">
          {metrics.status === 'active' ? 'İlk ölçüm yayından yaklaşık 24 saat sonra yapılır.' : 'Ölçüm yok.'}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {metrics.snapshots.length > 1 && (
          <button type="button" onClick={() => setHistoryOpen((v) => !v)} className="text-xs text-soft-gold hover:underline">
            {historyOpen ? 'Geçmişi gizle' : `Ölçüm geçmişi (${metrics.snapshots.length})`}
          </button>
        )}
        {metrics.manual && (metrics.manual.allowed || metrics.manual.available_at) && (
          <button
            type="button"
            disabled={busy || !metrics.manual.allowed}
            onClick={refresh}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold text-gray-200 transition hover:border-soft-gold hover:text-soft-gold disabled:opacity-50"
            title={`${MANUAL_REFRESH_HOURS} saatte bir güncellenebilir`}
          >
            {busy ? 'Ölçülüyor…' : metrics.manual.allowed ? 'Şimdi güncelle' : `Şimdi güncelle (${formatDateTime(metrics.manual.available_at)})`}
          </button>
        )}
      </div>
      {message && <p className={`mt-1 text-xs ${message.type === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{message.text}</p>}

      {historyOpen && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs text-gray-300">
            <thead className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
              <tr>
                <th className="py-1 pr-2 font-medium">Ölçüm</th>
                <th className="py-1 pr-2 font-medium">İzlenme</th>
                <th className="py-1 pr-2 font-medium">Beğeni</th>
                <th className="py-1 pr-2 font-medium">Yorum</th>
                <th className="py-1 font-medium">Etkileşim</th>
              </tr>
            </thead>
            <tbody>
              {metrics.snapshots.map((s) => (
                <tr key={s.captured_at} className="border-t border-white/5 tabular-nums">
                  <td className="py-1 pr-2">
                    {formatDateTime(s.captured_at)} <span className="text-gray-500">· {METRIC_STAGE_LABELS[s.stage]}</span>
                  </td>
                  <td className="py-1 pr-2">{formatCount(s.views)}</td>
                  <td className="py-1 pr-2">{formatCount(s.likes)}</td>
                  <td className="py-1 pr-2">{formatCount(s.comments)}</td>
                  <td className="py-1">{formatPercent(engagementOf(s, metrics.followers_at_publish))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-gray-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-white">{value}</dd>
    </div>
  )
}
