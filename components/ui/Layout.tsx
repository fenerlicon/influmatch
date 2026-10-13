import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Sayfa başlığı: serif başlık, açıklama, sağda eylemler (en fazla bir altın buton). */
export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-[22px] flex flex-col items-start justify-between gap-4 md:flex-row md:items-end', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[30px] font-normal leading-[1.1] tracking-[-0.01em] text-ink md:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Küçük büyük harfli etiket. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint', className)}>{children}</div>
}

/** Özet sayı kartı. */
export function StatCard({ label, value, detail, className }: { label: ReactNode; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface-1 px-[18px] py-4', className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{value}</div>
      {detail && <div className="mt-0.5 text-xs text-ink-faint">{detail}</div>}
    </div>
  )
}

/** Boş durum: ne olmadığını ve ne yapılacağını söyler. */
export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-9 text-center', className)}>
      {Icon && (
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-3 text-ink-muted">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      )}
      <div className="text-sm font-semibold text-ink">{title}</div>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** İnce ilerleme çubuğu (0–100). */
export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn('h-1.5 overflow-hidden rounded-full bg-surface-3', className)}>
      <div className="h-full rounded-full bg-gold" style={{ width: `${v}%` }} />
    </div>
  )
}

/** Doğrulama tiki: mavi (doğrulanmış hesap) veya altın (onaylı marka / resmi). */
export function VerifiedTick({ tone = 'blue', className, label }: { tone?: 'blue' | 'gold'; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={label ?? (tone === 'gold' ? 'Onaylı marka' : 'Doğrulanmış hesap')}
      className={cn('inline-block h-3.5 w-3.5 flex-none align-[-2px]', tone === 'gold' ? 'text-gold' : 'text-info', className)}
    >
      <path d="M12 2l2.4 2.1 3.1-.4.9 3 2.7 1.6-1 3 1 3-2.7 1.6-.9 3-3.1-.4L12 22l-2.4-2.1-3.1.4-.9-3-2.7-1.6 1-3-1-3 2.7-1.6.9-3 3.1.4z" />
      <path d="M8 12l3 3 5-6" stroke="#0C0D10" strokeWidth="2" fill="none" />
    </svg>
  )
}
