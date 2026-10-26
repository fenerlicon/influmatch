import { influencerBadges, brandBadges, phaseConfig } from '@/app/badges/data'
import type { Badge } from '@/app/badges/data'
import type { LucideIcon } from 'lucide-react'
import { Chip } from '@/components/ui'

interface BadgeDetailListProps {
  badgeIds: string[]
  userRole: 'influencer' | 'brand'
  /** En fazla bu kadar rozet (ör. profilde "öne çıkan" 3). */
  limit?: number
}

function BadgeItem({ badge }: { badge: Badge }) {
  const Icon = badge.icon as LucideIcon
  return (
    <div className={`grid content-start gap-2 rounded-xl border bg-surface-2 p-3.5 ${badge.highlight ? 'border-gold/40' : 'border-line'}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/10 text-gold">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <div className="text-[13px] font-medium text-ink">{badge.name}</div>
        <div className="mt-0.5 text-xs text-ink-faint">{badge.description}</div>
      </div>
      <Chip className="justify-self-start">{phaseConfig[badge.phase].label}</Chip>
    </div>
  )
}

/** Kullanıcının rozetleri (yalnızca kazanılanlar). Çerçevesiz ızgara; başlığı çağıran sayfa verir. */
export default function BadgeDetailList({ badgeIds, userRole, limit }: BadgeDetailListProps) {
  const allBadges = userRole === 'influencer' ? influencerBadges : brandBadges
  const badges = badgeIds
    .map((id) => allBadges.find((b) => b.id === id))
    .filter((b): b is Badge => b !== undefined)
    .slice(0, limit)

  if (badges.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {badges.map((badge) => (
        <BadgeItem key={badge.id} badge={badge} />
      ))}
    </div>
  )
}
