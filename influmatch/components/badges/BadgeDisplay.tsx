'use client'

import { useState } from 'react'
import { influencerBadges, brandBadges, type Badge, phaseConfig } from '@/app/badges/data'
import type { LucideIcon } from 'lucide-react'

interface BadgeDisplayProps {
  badgeIds: string[]
  userRole: 'influencer' | 'brand'
  size?: 'small' | 'medium' | 'large'
  maxDisplay?: number
}

interface BadgeIconProps {
  badge: Badge
  size: 'small' | 'medium' | 'large'
  userRole: 'influencer' | 'brand'
}

function BadgeIcon({ badge, size, userRole }: BadgeIconProps) {
  const [isHovered, setIsHovered] = useState(false)
  const config = phaseConfig[badge.phase]
  const Icon = badge.icon as LucideIcon

  const sizeClasses = {
    small: 'h-5 w-5',
    medium: 'h-6 w-6',
    large: 'h-8 w-8',
  }

  const iconSizeClasses = {
    small: 'h-3 w-3',
    medium: 'h-4 w-4',
    large: 'h-5 w-5',
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-lg ${config.bgColor} ${config.borderColor} border cursor-help`}
      >
        <Icon className={`${iconSizeClasses[size]} ${config.textColor}`} />
      </div>
      {isHovered && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/20 bg-black/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
          {badge.name}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white/20" />
        </div>
      )}
    </div>
  )
}

export default function BadgeDisplay({ badgeIds, userRole, size = 'small', maxDisplay }: BadgeDisplayProps) {
  if (!badgeIds || badgeIds.length === 0) return null

  const allBadges = userRole === 'influencer' ? influencerBadges : brandBadges
  const badgesToShow = maxDisplay ? badgeIds.slice(0, maxDisplay) : badgeIds
  const badges = badgesToShow
    .map((id) => allBadges.find((b) => b.id === id))
    .filter((b): b is Badge => b !== undefined)

  if (badges.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {badges.map((badge) => (
        <BadgeIcon key={badge.id} badge={badge} size={size} userRole={userRole} />
      ))}
      {maxDisplay && badgeIds.length > maxDisplay && (
        <span className="text-xs text-gray-400">+{badgeIds.length - maxDisplay}</span>
      )}
    </div>
  )
}
