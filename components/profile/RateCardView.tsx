import { RATE_CARD_ITEMS, formatTry, type RateCard } from '@/lib/rate-card-shared'

interface Props {
  rateCard: RateCard
  /** Profil sahibi kendi kartına bakıyorsa kimlerin gördüğü hatırlatılır. */
  isOwner?: boolean
}

// Fiyatlar influencer'ın kendi girdiği başlangıç fiyatlarıdır.
export default function RateCardView({ rateCard, isOwner = false }: Props) {
  const rows = RATE_CARD_ITEMS.filter((item) => typeof rateCard.prices[item.key] === 'number')
  if (rows.length === 0) return null
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Fiyat Kartı</p>
      <p className="mb-4 mt-1 text-xs text-gray-400">Teslimat başına başlangıç fiyatları</p>
      <ul className="space-y-2">
        {rows.map((item) => (
          <li key={item.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="font-semibold text-gray-200">{item.label}</span>
            <span className="text-white">{formatTry(rateCard.prices[item.key] as number)}+</span>
          </li>
        ))}
      </ul>
      {rateCard.negotiable && <p className="mt-3 text-xs text-emerald-300">Pazarlığa açık</p>}
      {isOwner && <p className="mt-3 text-xs text-gray-500">Fiyat kartınızı yalnızca doğrulanmış markalar görür.</p>}
    </div>
  )
}
