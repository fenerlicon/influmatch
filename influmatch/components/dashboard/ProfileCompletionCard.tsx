'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useMemo, useState } from 'react'
import type { ProfileRecord } from '@/utils/profileCompletion'
import { calculateProfileCompletion } from '@/utils/profileCompletion'

interface ProfileCompletionCardProps {
  userId: string
  initialProfile: ProfileRecord
  role?: 'influencer' | 'brand'
}

export default function ProfileCompletionCard({
  userId,
  initialProfile,
  role,
}: ProfileCompletionCardProps) {
  const supabase = useSupabaseClient()
  const [profile, setProfile] = useState<ProfileRecord>(initialProfile)

  useEffect(() => {
    const channel = supabase
      .channel(`profile-completion-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          setProfile((prev) => ({
            ...prev,
            ...(payload.new as ProfileRecord),
            social_links: (payload.new as ProfileRecord).social_links ?? prev.social_links,
          }))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          setProfile((prev) => ({
            ...prev,
            ...(payload.new as ProfileRecord),
            social_links: (payload.new as ProfileRecord).social_links ?? prev.social_links,
          }))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  const completion = useMemo(() => calculateProfileCompletion(profile, role), [profile, role])
  const remainingTasks = completion.pendingTasks.slice(0, 3)

  // Award profile-expert badge when completion reaches 100%
  useEffect(() => {
    if (completion.percent >= 100 && role === 'influencer') {
      // Check if user already has profile-expert badge
      supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId)
        .eq('badge_id', 'profile-expert')
        .maybeSingle()
        .then(({ data: existingBadge }) => {
          // Only award if badge doesn't exist
          if (!existingBadge) {
            // Call API to award badge
            fetch('/api/award-badges', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId }),
            })
              .then((response) => response.json())
              .then((data) => {
                if (data.success) {
                  console.log('[ProfileCompletionCard] Profile Expert badge awarded successfully')
                }
              })
              .catch((error) => {
                console.error('[ProfileCompletionCard] Failed to award badge:', error)
              })
          }
        })
    }
  }, [completion.percent, role, userId, supabase])

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Profil Doluluk</p>
          <h3 className="mt-2 text-xl font-semibold text-white">%{completion.percent} tamamlandı</h3>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300">
          {completion.total - completion.completed} görev kaldı
        </span>
      </div>

      <div className="mt-6 h-2 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-soft-gold shadow-[0_0_22px_rgba(212,175,55,0.45)]"
          style={{ width: `${completion.percent}%` }}
        />
      </div>

      {remainingTasks.length ? (
        <ul className="mt-6 space-y-3 text-sm text-gray-300">
          {remainingTasks.map((task) => (
            <li key={task} className="flex items-center gap-3 rounded-2xl border border-white/5 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-soft-gold" />
              {task}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Profilin güncel. Harika görünüyorsun!
        </div>
      )}
    </div>
  )
}


