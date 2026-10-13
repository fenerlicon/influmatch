import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Altın çerçeveli vurgu kartı (ör. Spotlight); sayfada nadiren. */
  accent?: boolean
  /** İç boşluk (20 px). Başlıklı kartlarda CardHeader + CardBody kullan. */
  padded?: boolean
  as?: 'div' | 'section' | 'article' | 'aside'
}

export function Card({ accent, padded, as: Tag = 'div', className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-line bg-surface-1',
        accent && 'border-gold/30 bg-[linear-gradient(180deg,rgba(212,175,55,0.10),transparent_70%)] bg-surface-1',
        padded && 'p-5',
        className,
      )}
      {...props}
    />
  )
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Sağdaki eylem (ör. "Tümü" bağlantısı). */
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] text-ink-faint">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

/** Kart içindeki liste satırı; satır eylemleri dar ekranda alta iner. */
export function ListRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-line px-5 py-3 last:border-b-0 hover:bg-white/[0.015]',
        className,
      )}
      {...props}
    />
  )
}
