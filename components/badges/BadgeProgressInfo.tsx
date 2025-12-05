'use client'

import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle2, Circle, Info } from 'lucide-react'
import type { Badge } from '@/app/badges/data'
import { influencerBadges, brandBadges } from '@/app/badges/data'

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

  const getBadgeRequirement = (badge: Badge): string => {
    // This logic was previously relying on translation keys.
    // Now we need to map badge IDs to their requirements in Turkish.
    // Since we don't have the translation file content readily available here for all keys,
    // I will use a mapping based on common badge IDs or default to a generic message if specific ones are missing.
    // Ideally, this information should come from the badge data itself if refactored further.

    const requirements: Record<string, string> = {
      'verified-account': 'Hesabınızı doğrulayarak bu rozeti kazanabilirsiniz.',
      'rising-star': 'Son 30 günde etkileşim oranınızı %20 artırın.',
      'community-leader': '1000+ takipçiye ulaşın ve aktif bir topluluk oluşturun.',
      'content-creator': 'Düzenli olarak haftada en az 3 içerik paylaşın.',
      'trend-setter': 'İçerikleriniz keşfet sayfasında yer alsın.',
      'brand-favorite': 'En az 5 marka ile başarılı işbirliği yapın.',
      'reliable-partner': 'İşbirliklerini zamanında ve eksiksiz tamamlayın.',
      'early-adopter': 'Platformun ilk üyelerinden biri olun.',
      'premium-member': 'Premium üyelik avantajlarından yararlanın.',
      'corporate': 'Kurumsal hesap doğrulamasını tamamlayın.',
      'brand-ambassador': 'Marka elçisi programına katılın.'
    }

    return requirements[badge.id] || 'Bu rozeti kazanmak için platformdaki aktivitelerinizi artırın.'
  }

  const isComingSoon = (badge: Badge): boolean => {
    const comingSoonBadges = ['corporate', 'brand-ambassador']
    return comingSoonBadges.includes(badge.id)
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
            {unownedMvpBadges.map((badge) => {
              const comingSoon = isComingSoon(badge)
              return (
                <div
                  key={badge.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-transform hover:scale-[1.01] ${comingSoon
                    ? 'border-amber-500/25 bg-amber-500/8 opacity-85'
                    : 'border-amber-500/30 bg-amber-500/10'
                    }`}
                >
                  <Circle
                    className={`h-5 w-5 flex-shrink-0 ${comingSoon ? 'text-amber-500/70' : 'text-amber-400'
                      }`}
                  />
                  <div className="flex-1">
                    <p
                      className={`font-semibold ${comingSoon ? 'text-white/90' : 'text-white'
                        }`}
                    >
                      {badge.name}
                    </p>
                    <p
                      className={`mt-1 text-sm ${comingSoon ? 'text-gray-300/90' : 'text-gray-300'
                        }`}
                    >
                      {badge.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">{getBadgeRequirement(badge)}</p>
                  </div>
                </div>
              )
            })}
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
