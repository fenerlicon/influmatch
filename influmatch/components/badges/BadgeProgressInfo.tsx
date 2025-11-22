'use client'

import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { motion } from 'framer-motion'
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
    const badgeRequirements: Record<string, string> = {
      // Influencer MVP
      'verified-account': 'Hesabınızın admin tarafından onaylanması gerekiyor.',
      'founder-member': 'İlk 1000 üye arasında olmanız gerekiyor. Bu rozet artık verilemez.',
      'corporate': 'Vergi levhası bilgilerinizi profilinize eklemeniz gerekiyor. (Yakında)',
      'profile-expert': 'Profilinizi %100 tamamlamanız gerekiyor.',
      'brand-ambassador': 'Referans linkinizle yeni üyeler kazandırmanız gerekiyor. (Yakında)',
      // Brand MVP
      'official-business': 'Hesabınızın admin tarafından onaylanması gerekiyor.',
      'pioneer-brand': 'İlk 100 marka arasında olmanız gerekiyor. Bu rozet artık verilemez.',
      'showcase-brand': 'Profilinizi %100 tamamlamanız gerekiyor.',
      // Future badges
      'lightning-fast': 'Mesajlara 30 dakika içinde cevap vermelisiniz. (v1.2 sürümünde aktif)',
      'five-star': '5 yıldız değerlendirme almalısınız. (v1.2 sürümünde aktif)',
      'trendsetter': 'Yüksek etkileşim oranlarına sahip olmalısınız. (v1.2 sürümünde aktif)',
      'million-club': '1 milyondan fazla takipçiniz olmalı. (v1.3 sürümünde aktif)',
      'conversion-wizard': 'Yüksek satış dönüşüm oranlarına sahip olmalısınız. (v1.3 sürümünde aktif)',
      'jet-approval': 'Teklifleri hızlıca onaylamalısınız. (v1.2 sürümünde aktif)',
      'elite-budget': 'Yüksek bütçeli teklifler vermelisiniz. (v1.2 sürümünde aktif)',
      'communication-expert': 'Hızlı ve kibar iletişim kurmalısınız. (v1.2 sürümünde aktif)',
      'loyal-partner': 'Aynı kişilerle tekrar çalışmalısınız. (v1.3 sürümünde aktif)',
      'global': 'Uluslararası kampanyalar yapmalısınız. (v1.3 sürümünde aktif)',
    }

    return badgeRequirements[badge.id] || 'Bu rozet için gereksinimler yakında açıklanacak.'
  }

  const isComingSoon = (badge: Badge): boolean => {
    const comingSoonBadges = ['corporate', 'brand-ambassador']
    return comingSoonBadges.includes(badge.id)
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
        Rozet bilgileri yükleniyor...
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
          <h2 className="text-xl font-semibold text-white md:text-2xl">MVP Rozet Durumunuz</h2>
          <p className="mt-1 text-sm text-gray-400">
            MVP sürümünde {mvpBadges.length} rozet bulunmaktadır. {ownedMvpBadges.length} tanesine sahipsiniz.
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
            {ownedMvpBadges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -2, scale: 1.01 }}
                className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition-all"
              >
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <p className="font-semibold text-white">{badge.name}</p>
                  <p className="mt-1 text-sm text-gray-300">{badge.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Unowned MVP Badges */}
      {unownedMvpBadges.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
            Kazanılabilir Rozetler ({unownedMvpBadges.length})
          </h3>
          <div className="space-y-2">
            {unownedMvpBadges.map((badge, index) => {
              const comingSoon = isComingSoon(badge)
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ y: -2, scale: 1.01 }}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-all ${
                    comingSoon
                      ? 'border-amber-500/25 bg-amber-500/8 opacity-85'
                      : 'border-amber-500/30 bg-amber-500/10'
                  }`}
                >
                  <Circle
                    className={`h-5 w-5 flex-shrink-0 ${
                      comingSoon ? 'text-amber-500/70' : 'text-amber-400'
                    }`}
                  />
                  <div className="flex-1">
                    <p
                      className={`font-semibold ${
                        comingSoon ? 'text-white/90' : 'text-white'
                      }`}
                    >
                      {badge.name}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        comingSoon ? 'text-gray-300/90' : 'text-gray-300'
                      }`}
                    >
                      {badge.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">{getBadgeRequirement(badge)}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Future Badges Info */}
      {futureBadges.length > 0 && (
        <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-purple-300">
            Gelecek Sürümlerde Gelecek Rozetler
          </h3>
          <p className="text-sm text-gray-300">
            v1.2 ve v1.3 sürümlerinde {futureBadges.length} yeni rozet daha eklenecek. Bu rozetler için gereksinimler
            sürüm yayınlandığında açıklanacak.
          </p>
        </div>
      )}
    </div>
  )
}

