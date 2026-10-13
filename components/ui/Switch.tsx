'use client'

import { cn } from '@/utils/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** Erişilebilir ad; görünür etiket yoksa zorunlu. */
  label?: string
  id?: string
  className?: string
}

export function Switch({ checked, onChange, disabled, label, id, className }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 flex-none rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50',
        checked ? 'border-gold bg-gold' : 'border-line-strong bg-surface-3',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-3.5 w-3.5 rounded-full transition-[left,background-color]',
          checked ? 'left-[18px] bg-gold-ink' : 'left-[2px] bg-ink-faint',
        )}
      />
    </button>
  )
}
