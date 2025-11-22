'use client'

import { useState } from 'react'
import { influencerBadges, brandBadges, phaseConfig } from '@/app/badges/data'
import type { Badge } from '@/app/badges/data'
import type { LucideIcon } from 'lucide-react'

interface BadgeDetailListProps {
  badgeIds: string[]
  userRole: 'influencer' | 'brand'
}

export default function BadgeDetailList({ badgeIds, userRole }: BadgeDetailListProps) {
  const allBadges = userRole === 'influencer' ? influencerBadges : brandBadges
  const badges = badgeIds
    .map((id) => allBadges.find((b) => b.id === id))
    .filter((b): b is Badge => b !== undefined)

  if (badges.length === 0) return null

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Rozetler</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => {
          const config = phaseConfig[badge.phase]
          const Icon = badge.icon as LucideIcon
          const [isHovered, setIsHovered] = useState(false)

          return (
            <div
              key={badge.id}
              className="relative"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className={`rounded-2xl border ${config.borderColor} ${config.bgColor} p-4 transition-all ${isHovered ? 'scale-[1.02]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${config.bgColor}`}
                  >
                    <Icon className={`h-5 w-5 ${config.textColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{badge.name}</p>
                    <p className="mt-1 text-xs text-gray-400">{badge.description}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.textColor}`}
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
        })}
      </div>
    </section>
  )
}

