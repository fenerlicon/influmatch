'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { influencerBadges, brandBadges, phaseConfig } from '@/app/badges/data'
import { Check, type LucideIcon } from 'lucide-react'

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

  // Vitrin en fazla 3 rozet alır; mavi tik varsa otomatik olarak bir yer kaplar.
  const hasBlueTick = availableBadgeIds.includes('verified-account')
  const maxSelectable = hasBlueTick ? 2 : 3
  const selectedCount = selectedBadgeIds.filter((id) => id !== 'verified-account').length
  const isFull = selectedCount >= maxSelectable

  const handleToggle = (badgeId: string) => {
    if (selectedBadgeIds.includes(badgeId)) {
      // Remove badge
      onSelectionChange(selectedBadgeIds.filter((id) => id !== badgeId))
    } else if (!isFull) {
      onSelectionChange([...selectedBadgeIds, badgeId])
    }
  }

  if (availableBadges.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface-2 p-6 text-center text-[13px] text-ink-muted">
        Henüz hiç rozet kazanmadınız. Rozetler sayfasından mevcut rozetleri görüntüleyebilirsiniz.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold text-ink">Profilde gösterilecek rozetler</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Profilinizde görünecek en fazla {maxSelectable} rozeti seçin. ({selectedCount}/{maxSelectable})
            {hasBlueTick && ' Mavi tik otomatik olarak gösterilir.'}
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
              disabled={disabled || (!isSelected && isFull)}
              aria-pressed={isSelected}
              className={`relative flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${isSelected
                ? 'border-gold bg-gold/10'
                : 'border-line-strong bg-surface-1 hover:border-white/20'
                } ${disabled || (!isSelected && isFull) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ${isSelected ? 'bg-gold/15 text-gold' : 'bg-surface-3 text-ink-muted'}`}>
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink">{badge.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint">{badge.description}</p>
                <span className="mt-1.5 inline-block text-[11px] text-ink-faint">{config.label}</span>
              </div>
              {isSelected && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-gold text-gold-ink">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
