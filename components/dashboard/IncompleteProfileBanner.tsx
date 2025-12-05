'use client'

import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { UserRole } from '@/types/auth'

interface IncompleteProfileBannerProps {
  userId: string
  role: UserRole
  initialVerificationStatus: 'pending' | 'verified' | 'rejected'
  initialSocialLinks: Record<string, string | null> | null
}

export default function IncompleteProfileBanner({
  userId,
  role,
  initialVerificationStatus,
  initialSocialLinks,
}: IncompleteProfileBannerProps) {
  const supabase = useSupabaseClient()
  const [verificationStatus, setVerificationStatus] = useState(initialVerificationStatus)
  const [socialLinks, setSocialLinks] = useState(initialSocialLinks)

  useEffect(() => {
    const channel = supabase
      .channel(`user-profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new.verification_status) {
            setVerificationStatus(payload.new.verification_status as 'pending' | 'verified' | 'rejected')
          }
          if (payload.new.social_links) {
            setSocialLinks(payload.new.social_links as Record<string, string | null> | null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  const socialLinksCount = Object.values(socialLinks ?? {}).filter((link) => link && link.trim().length > 0).length
  const hasAtLeastOneSocialLink = socialLinksCount >= 1
  const showBanner = verificationStatus === 'pending' && !hasAtLeastOneSocialLink

  if (!showBanner) return null

  return (
    <div className="border-b border-orange-500/30 bg-orange-500/10 px-4 py-3 sm:px-6 lg:px-10">
      <div className="mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 text-sm text-orange-200">
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 flex-shrink-0 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>
            <strong>Önemli:</strong> Profilinizin onaylanması ve markalarla eşleşebilmeniz için en az bir sosyal medya hesabı eklemeniz gerekmektedir.
          </p>
        </div>
        <a
          href={role === 'brand' ? '/dashboard/brand/profile' : '/dashboard/influencer/profile'}
          className="inline-flex items-center gap-1 rounded-xl border border-orange-400/40 bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-200 transition hover:border-orange-400 hover:bg-orange-500/30 whitespace-nowrap"
        >
          Profili Tamamla
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  )
}
