'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { influencerBadges, brandBadges, type Badge, phaseConfig } from '@/app/badges/data'
import type { LucideIcon } from 'lucide-react'

interface BadgeSelectorProps {
  userRole: 'influencer' | 'brand'
  selectedBadgeIds: string[]
  availableBadgeIds: string[]
  onSelectionChange: (badgeIds: string[]) => void
  disabled?: boolean
  userId?: string
}

export default function BadgeSelector({
  userRole,
  selectedBadgeIds,
  availableBadgeIds: initialAvailableBadgeIds,
  onSelectionChange,
  disabled = false,
  userId,
}: BadgeSelectorProps) {
  const supabase = useSupabaseClient()
  const [availableBadgeIds, setAvailableBadgeIds] = useState<string[]>(initialAvailableBadgeIds)

  // Real-time subscription for user_badges
  useEffect(() => {
    if (!userId) return

    // Update from initial props
    setAvailableBadgeIds(initialAvailableBadgeIds)

    const channel = supabase
      .channel(`user-badges-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newBadgeId = payload.new.badge_id as string
          setAvailableBadgeIds((prev) => {
            if (!prev.includes(newBadgeId)) {
              return [...prev, newBadgeId]
            }
            return prev
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const removedBadgeId = payload.old.badge_id as string
          setAvailableBadgeIds((prev) => prev.filter((id) => id !== removedBadgeId))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, initialAvailableBadgeIds])

  const allBadges = useMemo(() => {
    return userRole === 'influencer' ? influencerBadges : brandBadges
  }, [userRole])

  // Filter out verified-account badge as it's automatically shown with blue tick
  const availableBadges = useMemo(() => {
    return allBadges.filter(
      (badge) => availableBadgeIds.includes(badge.id) && badge.id !== 'verified-account'
    )
  }, [allBadges, availableBadgeIds])

  const handleToggle = (badgeId: string) => {
    if (selectedBadgeIds.includes(badgeId)) {
      // Remove badge
      onSelectionChange(selectedBadgeIds.filter((id) => id !== badgeId))
    } else {
      // Add badge (max 3)
      if (selectedBadgeIds.length < 3) {
        onSelectionChange([...selectedBadgeIds, badgeId])
      }
    }
  }

  if (availableBadges.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
        Henüz hiç rozet kazanmadınız. Rozetler sayfasından mevcut rozetleri görüntüleyebilirsiniz.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Rozet Seçimi</p>
          <p className="mt-1 text-xs text-gray-400">
            Profilinizde görünecek en fazla 3 rozeti seçin. ({selectedBadgeIds.length}/3)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {availableBadges.map((badge) => {
          const isSelected = selectedBadgeIds.includes(badge.id)
          const config = phaseConfig[badge.phase]
          const Icon = badge.icon as LucideIcon

          return (
            <button
              key={badge.id}
              type="button"
              onClick={() => handleToggle(badge.id)}
              disabled={disabled || (!isSelected && selectedBadgeIds.length >= 3)}
              className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition ${isSelected
                ? `${config.borderColor} ${config.bgColor} ${config.glowColor}`
                : 'border-white/10 bg-white/5 hover:border-white/20'
                } ${disabled || (!isSelected && selectedBadgeIds.length >= 3) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${isSelected ? config.bgColor : 'bg-white/5'
                  }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? config.textColor : 'text-gray-400'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                  {badge.name}
                </p>
                <p className="mt-1 text-xs text-gray-400 line-clamp-2">{badge.description}</p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${isSelected ? config.textColor : 'text-gray-500'
                    }`}
                >
                  {config.label}
                </span>
              </div>
              {isSelected && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <span className="text-xs">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
