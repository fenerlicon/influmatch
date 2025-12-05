'use client'

import { useState, useMemo, useEffect } from 'react'
import { Award, Loader2 } from 'lucide-react'
import BadgeCard from '@/components/badges/BadgeCard'
import BadgeToggle from '@/components/badges/BadgeToggle'
import BadgeProgressInfo from '@/components/badges/BadgeProgressInfo'
import { influencerBadges, brandBadges, phaseConfig, type BadgePhase } from '@/app/badges/data'

export default function BrandBadgesPage() {
  const [activeTab, setActiveTab] = useState<'influencer' | 'brand'>('brand')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const badges = useMemo(() => {
    return activeTab === 'influencer' ? influencerBadges : brandBadges
  }, [activeTab])

  const badgesByPhase = useMemo(() => {
    const mvp = badges.filter((b) => b.phase === 'mvp')
    const v12 = badges.filter((b) => b.phase === 'v1.2')
    const v13 = badges.filter((b) => b.phase === 'v1.3')
    return { mvp, 'v1.2': v12, 'v1.3': v13 }
  }, [badges])

  if (!isMounted) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-soft-gold" />
          <p className="text-sm text-gray-400">Rozetler yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-6 text-white shadow-glow">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-soft-gold/30 bg-soft-gold/10 px-4 py-2">
          <Award className="h-4 w-4 text-soft-gold" />
          <span className="text-xs uppercase tracking-[0.3em] text-soft-gold">Rozet Sistemi</span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
          Prestijin Yeni Tanımı:{' '}
          <span className="bg-gradient-to-r from-soft-gold via-amber-300 to-soft-gold bg-clip-text text-transparent">
            Influmatch Rozetleri
          </span>
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-300 md:text-base">
          Rozetler, platformumuzda güveni ve prestiji simgeler. Kurumsal kimlik doğrulamasından başarı metriklerine kadar,
          her rozet markanızın görünürlüğünü artırır ve influencerların sizi keşfetmesini kolaylaştırır. Algoritmamız,
          rozetli profilleri önceliklendirerek daha fazla işbirliği fırsatı sunar.
        </p>
      </header>

      {/* Toggle Switch */}
      <section className="flex justify-center">
        <BadgeToggle activeTab={activeTab} onTabChange={setActiveTab} />
      </section>

      {/* Badges Listing */}
      <section className="space-y-12">
        {(['mvp', 'v1.2', 'v1.3'] as BadgePhase[]).map((phase) => {
          const phaseBadges = badgesByPhase[phase]
          if (phaseBadges.length === 0) return null

          const config = phaseConfig[phase]

          return (
            <div
              key={`${activeTab}-${phase}`}
              className={`rounded-3xl border ${config.borderColor} ${config.bgColor} p-6 backdrop-blur-sm ${config.glowColor} md:p-8`}
            >
              <div className="mb-6 flex items-center gap-3">
                <div
                  className={`h-1 w-12 rounded-full bg-gradient-to-r ${phase === 'mvp'
                    ? 'from-amber-500'
                    : phase === 'v1.2'
                      ? 'from-slate-500 opacity-70'
                      : 'from-purple-500 opacity-70'
                    } to-transparent`}
                />
                <h2 className={`text-xl font-semibold ${config.textColor} md:text-2xl`}>{config.label}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {phaseBadges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} phase={phase} />
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {/* Progress Info */}
      <section>
        <BadgeProgressInfo userRole="brand" />
      </section>
    </div>
  )
}

