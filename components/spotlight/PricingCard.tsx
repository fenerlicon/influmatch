import { Check } from 'lucide-react'
import { Button, Card, Chip } from '@/components/ui'
import { cn } from '@/utils/cn'

interface PricingFeature {
  text: string
  highlight?: boolean
}

interface PricingCardProps {
  title: string
  price: string
  interval: 'mo' | 'yr'
  features: PricingFeature[]
  recommended?: boolean
  buttonText?: string
  onSelect?: () => void
  onCancel?: () => void
  isCurrentPlan?: boolean
  isUpgrade?: boolean
  disabled?: boolean
}

export default function PricingCard({
  title,
  price,
  interval,
  features,
  recommended,
  buttonText = 'Paketi seç',
  onSelect,
  onCancel,
  isCurrentPlan,
  isUpgrade,
  disabled,
}: PricingCardProps) {
  let finalButtonText = buttonText
  if (isCurrentPlan) finalButtonText = 'Mevcut paket'
  else if (isUpgrade) finalButtonText = 'Paketi yükselt'

  return (
    <Card accent={recommended && !isCurrentPlan} className={cn('flex h-full flex-col p-6', isCurrentPlan && 'border-success/40')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
        {isCurrentPlan ? <Chip tone="success" dot>Aktif plan</Chip> : recommended ? <Chip tone="gold">Önerilen</Chip> : null}
      </div>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-[34px] leading-none tracking-tight text-ink">{price}</span>
        <span className="text-[13px] text-ink-faint">/ {interval === 'mo' ? 'ay' : 'yıl'}</span>
      </p>

      <ul className="mt-5 grid flex-1 content-start gap-2.5 border-t border-line pt-5">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
            <Check className="mt-0.5 h-4 w-4 flex-none text-gold" aria-hidden />
            <span className={feature.highlight ? 'text-ink' : 'text-ink-muted'}>{feature.text}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={recommended && !isCurrentPlan ? 'primary' : 'secondary'}
        className="mt-6 w-full"
        onClick={isCurrentPlan || disabled ? undefined : onSelect}
        disabled={isCurrentPlan || disabled}
      >
        {finalButtonText}
      </Button>

      {isCurrentPlan && onCancel && (
        <button type="button" onClick={onCancel} className="mt-3 text-xs text-ink-faint transition-colors hover:text-danger">
          Paketi iptal et
        </button>
      )}
    </Card>
  )
}
