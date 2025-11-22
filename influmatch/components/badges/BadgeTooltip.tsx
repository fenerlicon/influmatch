'use client'

import { useState } from 'react'
import { influencerBadges, brandBadges, type Badge } from '@/app/badges/data'

interface BadgeTooltipProps {
  badgeId: string
  userRole: 'influencer' | 'brand'
  children: React.ReactNode
}

export default function BadgeTooltip({ badgeId, userRole, children }: BadgeTooltipProps) {
  const [isHovered, setIsHovered] = useState(false)

  const allBadges = userRole === 'influencer' ? influencerBadges : brandBadges
  const badge = allBadges.find((b) => b.id === badgeId)

  if (!badge) return <>{children}</>

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/20 bg-black/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
          {badge.name}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white/20" />
        </div>
      )}
    </div>
  )
}

