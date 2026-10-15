import { Lock } from 'lucide-react'
import { RATE_CARD_ITEMS, formatTry, type RateCard } from '@/lib/rate-card-shared'
import { Card, Chip } from '@/components/ui'

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
    <Card padded>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-tight">Fiyat kartı</h2>
        {rateCard.negotiable && <Chip>Pazarlığa açık</Chip>}
      </div>
      <table className="mt-2 w-full text-[13.5px]">
        <tbody>
          {rows.map((item) => (
            <tr key={item.key} className="border-b border-line last:border-b-0">
              <td className="py-2.5 text-ink-muted">{item.label}</td>
              <td className="py-2.5 text-right tabular-nums text-ink">{formatTry(rateCard.prices[item.key] as number)}&apos;den</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
        <Lock className="h-3 w-3" aria-hidden />
        {isOwner ? 'Fiyat kartını yalnızca doğrulanmış markalar görür.' : 'Yalnızca doğrulanmış markalar görür.'}
      </p>
    </Card>
  )
}
