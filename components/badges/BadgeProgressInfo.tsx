'use client'

import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Card, CardBody, CardHeader, EmptyState, Progress } from '@/components/ui'
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
      'founder-member': 'Hesabınız 0₺ kampanyası başlamadan önce doğrulanırsa (onaylanırsa) verilir; kalıcıdır.',
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
      <Card>
        <EmptyState title="Yükleniyor…" />
      </Card>
    )
  }

  const ownedMvpBadges = mvpBadges.filter((b) => userBadgeIds.includes(b.id))
  const unownedMvpBadges = mvpBadges.filter((b) => !userBadgeIds.includes(b.id))

  return (
    <Card>
      <CardHeader
        title="Rozet durumun"
        description={`${mvpBadges.length} rozetten ${ownedMvpBadges.length} tanesine sahipsin.`}
        action={<Progress value={mvpBadges.length ? (ownedMvpBadges.length / mvpBadges.length) * 100 : 0} className="w-32" label="Rozet ilerlemesi" />}
      />
      <CardBody className="grid gap-5">
        {ownedMvpBadges.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-[13px] font-medium text-ink-muted">Sahip olduğun rozetler ({ownedMvpBadges.length})</h3>
            {ownedMvpBadges.map((badge) => (
              <div key={badge.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
                <CheckCircle2 className="h-[18px] w-[18px] flex-shrink-0 text-success" aria-label="Sahipsin" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">{badge.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {unownedMvpBadges.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-[13px] font-medium text-ink-muted">Kazanabileceğin rozetler ({unownedMvpBadges.length})</h3>
            {unownedMvpBadges.map((badge) => (
              <div key={badge.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-1 p-3.5">
                <Circle className="h-[18px] w-[18px] flex-shrink-0 text-ink-faint" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">{badge.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{badge.description}</p>
                  <p className="mt-1.5 text-xs text-ink-faint">{getBadgeRequirement(badge)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {futureBadges.length > 0 && (
          <p className="text-xs text-ink-faint">{futureBadges.length} rozet sonraki sürümlerde açılacak; aşağıdaki katalogda görebilirsin.</p>
        )}
      </CardBody>
    </Card>
  )
}
