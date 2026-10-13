import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Sparkles, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

// Bildirim satırı: panelin üstündeki bantların ve sayfa içi uyarı kartlarının yerine.
export type NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'gold'

const tones: Record<NoticeTone, { icon: LucideIcon; box: string }> = {
  info: { icon: Info, box: 'bg-info/10 text-info' },
  warning: { icon: AlertTriangle, box: 'bg-warning/10 text-warning' },
  danger: { icon: XCircle, box: 'bg-danger/10 text-danger' },
  success: { icon: CheckCircle2, box: 'bg-success/10 text-success' },
  gold: { icon: Sparkles, box: 'bg-gold/10 text-gold' },
}

interface NoticeProps {
  tone?: NoticeTone
  /** Varsayılan ikonun yerine. */
  icon?: LucideIcon
  title?: ReactNode
  children?: ReactNode
  /** Sağdaki eylem (buton/bağlantı). */
  action?: ReactNode
  /** Eylemden önce soluk ek bilgi (ör. "+1 bildirim"). */
  meta?: ReactNode
  className?: string
}

export function Notice({ tone = 'info', icon, title, children, action, meta, className }: NoticeProps) {
  const Icon = icon ?? tones[tone].icon
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-1 px-3.5 py-2.5 text-[13px]', className)}
    >
      <span className={cn('grid h-7 w-7 flex-none place-items-center rounded-lg', tones[tone].box)}>
        <Icon className="h-[15px] w-[15px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-[1_1_200px] text-ink">
        {title && <span className="font-medium">{title} </span>}
        {children && <span className="text-ink-muted">{children}</span>}
      </div>
      {meta && <span className="text-[12.5px] text-ink-faint">{meta}</span>}
      {action}
    </div>
  )
}
