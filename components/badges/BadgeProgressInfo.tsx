'use client'

import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle2, Circle, Info } from 'lucide-react'
import type { Badge } from '@/app/badges/data'
import { influencerBadges, brandBadges } from '@/app/badges/data'
import { BLUE_TICK_RULES } from '@/lib/blue-tick-rules'

interface BadgeProgressInfoProps {
  userRole: 'influencer' | 'brand'
}

export default function BadgeProgressInfo({ userRole }: BadgeProgressInfoProps) {
  const supabase = useSupabaseClient()
  const [userBadgeIds, setUserBadgeIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        const fetchUserBadges = async () => {
          const { data } = await supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', user.id)

          setUserBadgeIds(data?.map((b) => b.badge_id) ?? [])
        }

        await fetchUserBadges()
        setIsLoading(false)

        // Subscribe to real-time updates for this user
        channel = supabase
          .channel(`user-badges-updates-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_badges',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              fetchUserBadges()
            },
          )
          .subscribe()
      } catch (error) {
        console.error('Error initializing badge info:', error)
        setIsLoading(false)
      }
    }

    init()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  const allBadges = userRole === 'influencer' ? influencerBadges : brandBadges
  const mvpBadges = allBadges.filter((b) => b.phase === 'mvp')
  const futureBadges = allBadges.filter((b) => b.phase !== 'mvp')

  // Kazanma koşulları gerçek kurallarla aynı (lib/blue-tick-rules.ts, utils/badgeAwarding.ts,
  // lib/official-business.ts, lib/million-club.ts, lib/activity-badges.ts).
  const getBadgeRequirement = (badge: Badge): string => {
    const automatic = 'Koşulu sağladığınızda saatlik kontrolde otomatik verilir; koşul bozulursa geri alınır.'
    const requirements: Record<string, string> = {
      'verified-account': `Aktif Spotlight üyeliği, doğrulanmış hesapta en az ${BLUE_TICK_RULES.minFollowers.toLocaleString('tr-TR')} takipçi ve ${BLUE_TICK_RULES.minTrustScore}+ güven skoru ile otomatik verilir.`,
      'founder-member': 'Platforma katılan ilk 1000 influencer/UGC arasında olun.',
      'profile-expert': 'Profilinizi %100 doldurun.',
      'showcase-brand': 'Marka profilinizi %100 doldurun.',
      'pioneer-brand': 'Marka hesabınız onaylandığında verilir.',
      'official-business': 'Vergi levhanız onaylandıktan sonra şirket alan adınızdaki kurumsal e-postayı doğrulayın.',
      'million-club': automatic,
      'lightning-fast': automatic,
      'brand-ambassador': automatic,
      'jet-approval': automatic,
      'elite-budget': automatic,
    }

    return requirements[badge.id] || 'Bu rozet yakında kazanılabilir olacak.'
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
        Yükleniyor...
      </div>
    )
  }

  const ownedMvpBadges = mvpBadges.filter((b) => userBadgeIds.includes(b.id))
  const unownedMvpBadges = mvpBadges.filter((b) => !userBadgeIds.includes(b.id))

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-6 text-white shadow-glow md:p-8">
      <div className="mb-6 flex items-start gap-3">
        <Info className="h-5 w-5 flex-shrink-0 text-soft-gold md:h-6 md:w-6" />
        <div>
          <h2 className="text-xl font-semibold text-white md:text-2xl">Rozet Durumu</h2>
          <p className="mt-1 text-sm text-gray-400">
            Toplam {mvpBadges.length} başlangıç rozetinden {ownedMvpBadges.length} tanesine sahipsiniz.
          </p>
        </div>
      </div>

      {/* Owned MVP Badges */}
      {ownedMvpBadges.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-soft-gold">
            Sahip Olduğunuz Rozetler ({ownedMvpBadges.length})
          </h3>
          <div className="space-y-2">
            {ownedMvpBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition-transform hover:scale-[1.01]"
              >
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <p className="font-semibold text-white">{badge.name}</p>
                  <p className="mt-1 text-sm text-gray-300">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unowned MVP Badges */}
      {unownedMvpBadges.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
            Kazanabileceğiniz Rozetler ({unownedMvpBadges.length})
          </h3>
          <div className="space-y-2">
            {unownedMvpBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 transition-transform hover:scale-[1.01]"
              >
                <Circle className="h-5 w-5 flex-shrink-0 text-amber-400" />
                <div className="flex-1">
                  <p className="font-semibold text-white">{badge.name}</p>
                  <p className="mt-1 text-sm text-gray-300">{badge.description}</p>
                  <p className="mt-2 text-xs text-gray-500">{getBadgeRequirement(badge)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Future Badges Info */}
      {futureBadges.length > 0 && (
        <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-purple-300">
            Gelecek Rozetler
          </h3>
          <p className="text-sm text-gray-300">
            {futureBadges.length} yeni rozet yakında platforma eklenecek. Takipte kalın!
          </p>
        </div>
      )}
    </div>
  )
}
