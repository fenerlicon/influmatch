import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface TabItem {
  /** Bağlantı sekmesi için adres; yoksa onSelect ile çalışır. */
  href?: string
  value: string
  label: ReactNode
  count?: number | string
  icon?: ReactNode
}

interface TabsProps {
  items: TabItem[]
  value: string
  onSelect?: (value: string) => void
  className?: string
  /** Erişilebilir ad (ör. "Keşif görünümü"). */
  label?: string
}

/** Alt çizgili sekmeler; dar ekranda yatay kayar. */
export function Tabs({ items, value, onSelect, className, label }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-0.5 overflow-x-auto border-b border-line [scrollbar-width:none]', className)}>
      {items.map((item) => {
        const active = item.value === value
        const cls = cn(
          '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5',
          active ? 'border-gold text-ink' : 'border-transparent text-ink-muted hover:text-ink',
        )
        const inner = (
          <>
            {item.icon}
            {item.label}
            {item.count !== undefined && <span className="text-[11px] tabular-nums text-ink-faint">{item.count}</span>}
          </>
        )
        return item.href ? (
          <Link key={item.value} href={item.href} role="tab" aria-selected={active} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={item.value} type="button" role="tab" aria-selected={active} className={cls} onClick={() => onSelect?.(item.value)}>
            {inner}
          </button>
        )
      })}
    </div>
  )
}

interface SegmentedProps {
  items: Array<{ value: string; label: ReactNode; href?: string }>
  value: string
  onSelect?: (value: string) => void
  className?: string
  label?: string
}

/** Küçük filtre anahtarı (ör. Süren / Tümü / İptal). */
export function Segmented({ items, value, onSelect, className, label }: SegmentedProps) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex gap-0.5 rounded-[10px] border border-line bg-surface-2 p-[3px]', className)}>
      {items.map((item) => {
        const active = item.value === value
        const cls = cn(
          'whitespace-nowrap rounded-[7px] px-3 py-[5px] text-[12.5px] transition-colors',
          active ? 'bg-surface-3 text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.13)]' : 'text-ink-muted hover:text-ink',
        )
        return item.href ? (
          <Link key={item.value} href={item.href} aria-current={active ? 'true' : undefined} className={cls}>
            {item.label}
          </Link>
        ) : (
          <button key={item.value} type="button" aria-pressed={active} className={cls} onClick={() => onSelect?.(item.value)}>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
