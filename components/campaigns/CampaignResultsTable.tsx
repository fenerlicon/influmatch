import {
  engagementLabel,
  formatCount,
  formatMoney,
  formatPercent,
  type CampaignResults,
} from '@/lib/post-metrics-shared'

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/**
 * Kampanya sonuçları (3.20): toplam kutuları + profil satırları. Kampanya panosunda ve yazdırılabilir raporda aynı içerik;
 * print=true açık zeminde (siyah yazı) çizer. Yalnızca ölçülen sayılar; kıyas / ortalama iddiası yok.
 */
export default function CampaignResultsTable({ results, print = false }: { results: CampaignResults; print?: boolean }) {
  const { rows, summary } = results
  const tone = print
    ? { box: 'border border-gray-300 bg-white', label: 'text-gray-600', value: 'text-black', muted: 'text-gray-600', head: 'text-gray-600 border-gray-300', row: 'border-gray-200', text: 'text-black' }
    : { box: 'border border-line bg-surface-1', label: 'text-ink-faint', value: 'text-ink', muted: 'text-ink-faint', head: 'text-ink-faint border-line', row: 'border-line', text: 'text-ink' }

  const boxes: Array<{ label: string; value: string; detail?: string }> = [
    { label: 'Yayındaki gönderi', value: formatCount(summary.posts_live), detail: `${summary.creators} profil · ${summary.posts_measured} ölçüldü` },
    { label: 'Toplam izlenme', value: formatCount(summary.views), detail: 'İzlenme sayısı olan gönderiler' },
    { label: 'Beğeni / yorum', value: `${formatCount(summary.likes)} / ${formatCount(summary.comments)}` },
    {
      label: summary.engagement ? engagementLabel(summary.engagement.basis) : 'Etkileşim',
      value: formatPercent(summary.engagement),
    },
    { label: '1000 izlenme başı maliyet', value: formatMoney(summary.cost_per_1000_views), detail: 'Nakit ücretlere göre' },
    { label: 'Etkileşim başı maliyet', value: formatMoney(summary.cost_per_engagement), detail: 'Nakit ücret / (beğeni + yorum)' },
  ]

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {boxes.map((b) => (
          <div key={b.label} className={`rounded-2xl px-4 py-3 ${tone.box}`}>
            <div className={`text-[11px] font-medium uppercase tracking-[0.12em] ${tone.label}`}>{b.label}</div>
            <div className={`mt-1 text-[22px] font-semibold tabular-nums ${tone.value}`}>{b.value}</div>
            {b.detail && <div className={`mt-0.5 text-xs ${tone.muted}`}>{b.detail}</div>}
          </div>
        ))}
      </div>

      {(summary.unavailable > 0 || summary.unsupported > 0) && (
        <p className={`mt-3 text-xs ${tone.muted}`}>
          {summary.unavailable > 0 ? `${summary.unavailable} gönderiye ulaşılamıyor (silinmiş ya da gizli olabilir). ` : ''}
          {summary.unsupported > 0 ? `${summary.unsupported} bağlantı (story / YouTube) ölçülmüyor.` : ''}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className={`w-full min-w-[860px] text-left text-[13px] ${tone.text}`}>
            <thead className={`border-b text-[11px] uppercase tracking-[0.1em] ${tone.head}`}>
              <tr>
                <th className="px-3 py-2 font-medium">Profil</th>
                <th className="px-3 py-2 font-medium">Gönderi</th>
                <th className="px-3 py-2 font-medium">İzlenme</th>
                <th className="px-3 py-2 font-medium">Beğeni</th>
                <th className="px-3 py-2 font-medium">Yorum</th>
                <th className="px-3 py-2 font-medium">Etkileşim</th>
                <th className="px-3 py-2 font-medium">Nakit ücret</th>
                <th className="px-3 py-2 font-medium">1000 izlenme başı</th>
                <th className="px-3 py-2 font-medium">Etkileşim başı</th>
                <th className="px-3 py-2 font-medium">Son ölçüm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = r.creator.full_name || (r.creator.username ? `@${r.creator.username}` : 'Profil')
                return (
                  <tr key={r.key} className={`border-b tabular-nums ${tone.row}`}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{name}</span>
                      {r.creator.username && r.creator.full_name && <span className={`block text-xs ${tone.muted}`}>@{r.creator.username}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.posts_live} yayında
                      <span className={`block text-xs ${tone.muted}`}>{r.posts_measured} ölçüldü</span>
                    </td>
                    <td className="px-3 py-2">{formatCount(r.views)}</td>
                    <td className="px-3 py-2">{formatCount(r.likes)}</td>
                    <td className="px-3 py-2">{formatCount(r.comments)}</td>
                    <td className="px-3 py-2">
                      {formatPercent(r.engagement)}
                      {r.engagement && <span className={`block text-xs ${tone.muted}`}>{r.engagement.basis === 'views' ? 'izlenmeye göre' : 'takipçiye göre'}</span>}
                    </td>
                    <td className="px-3 py-2">{formatMoney(r.cash_fee)}</td>
                    <td className="px-3 py-2">{formatMoney(r.cost_per_1000_views)}</td>
                    <td className="px-3 py-2">{formatMoney(r.cost_per_engagement)}</td>
                    <td className="px-3 py-2">{formatDate(r.last_captured_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
