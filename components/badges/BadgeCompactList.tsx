'use client'

import { useState } from 'react'
import { phaseConfig } from '@/app/badges/data'
import type { Badge } from '@/app/badges/data'
import type { LucideIcon } from 'lucide-react'

interface BadgeCompactListProps {
  badges: Badge[]
  userRole: 'influencer' | 'brand'
}

interface BadgeItemProps {
  badge: Badge
}

function BadgeItem({ badge }: BadgeItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const config = phaseConfig[badge.phase]
  const Icon = badge.icon as LucideIcon

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-3 transition-all cursor-help ${isHovered ? 'scale-[1.02]' : ''
          }`}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
            <Icon className={`h-4 w-4 ${config.textColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">{badge.name}</p>
            <p className="mt-0.5 text-[10px] text-gray-400 line-clamp-1">{badge.description}</p>
            <span
              className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${config.textColor}`}
            >
              {config.label}
            </span>
          </div>
        </div>
      </div>
      {isHovered && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/20 bg-black/95 px-3 py-1.5 text-xs font-medium text-white shadow-xl backdrop-blur-sm">
          {badge.name}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white/20" />
        </div>
      )}
    </div>
  )
}

export default function BadgeCompactList({ badges, userRole }: BadgeCompactListProps) {
  if (badges.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">ROZETLER</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {badges.map((badge) => (
          <BadgeItem key={badge.id} badge={badge} />
        ))}
      </div>
    </div>
  )
}
