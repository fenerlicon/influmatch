import { phaseConfig } from '@/app/badges/data'
import type { Badge } from '@/app/badges/data'
import type { LucideIcon } from 'lucide-react'

interface BadgeCompactListProps {
  badges: Badge[]
  userRole: 'influencer' | 'brand' | 'admin'
}

/** Rozetlerin sıkı listesi (admin kullanıcı ayrıntısı). */
export default function BadgeCompactList({ badges }: BadgeCompactListProps) {
  if (badges.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {badges.map((badge) => {
        const config = phaseConfig[badge.phase]
        const Icon = badge.icon as LucideIcon
        return (
          <div key={badge.id} title={badge.description} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3">
            <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${config.bgColor}`}>
              <Icon className={`h-4 w-4 ${config.textColor}`} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{badge.name}</p>
              <p className="line-clamp-1 text-[11.5px] text-ink-faint">{badge.description}</p>
              <span className={`text-[10.5px] font-medium uppercase tracking-wider ${config.textColor}`}>{config.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
