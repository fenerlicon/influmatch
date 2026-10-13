import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

// Durum çipleri: renk yalnızca anlam taşır.
export type ChipTone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<ChipTone, string> = {
  neutral: 'border-line bg-surface-3 text-ink-muted',
  gold: 'border-gold/30 bg-gold/10 text-gold',
  success: 'border-transparent bg-success/10 text-success',
  warning: 'border-transparent bg-warning/10 text-warning',
  danger: 'border-transparent bg-danger/10 text-danger',
  info: 'border-transparent bg-info/10 text-info',
}

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
  /** Başta küçük nokta (durum göstergesi). */
  dot?: boolean
}

export function Chip({ tone = 'neutral', dot, className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-full border px-2 text-[11.5px] font-medium [&_svg]:h-3 [&_svg]:w-3',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
