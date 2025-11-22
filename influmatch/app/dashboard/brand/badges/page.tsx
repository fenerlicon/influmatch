'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award } from 'lucide-react'
import BadgeCard from '@/components/badges/BadgeCard'
import BadgeToggle from '@/components/badges/BadgeToggle'
import BadgeProgressInfo from '@/components/badges/BadgeProgressInfo'
import { influencerBadges, brandBadges, phaseConfig, type BadgePhase } from '@/app/badges/data'

export default function BrandBadgesPage() {
  const [activeTab, setActiveTab] = useState<'influencer' | 'brand'>('brand')

  const badges = activeTab === 'influencer' ? influencerBadges : brandBadges

  const badgesByPhase = {
    mvp: badges.filter((b) => b.phase === 'mvp'),
    'v1.2': badges.filter((b) => b.phase === 'v1.2'),
    'v1.3': badges.filter((b) => b.phase === 'v1.3'),
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
        <AnimatePresence mode="wait">
          {(['mvp', 'v1.2', 'v1.3'] as BadgePhase[]).map((phase) => {
            const phaseBadges = badgesByPhase[phase]
            if (phaseBadges.length === 0) return null

            const config = phaseConfig[phase]

            return (
              <motion.div
                key={`${activeTab}-${phase}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5 }}
                className={`rounded-3xl border ${config.borderColor} ${config.bgColor} p-6 backdrop-blur-sm ${config.glowColor} md:p-8`}
              >
                <div className="mb-6 flex items-center gap-3">
                  <div
                    className={`h-1 w-12 rounded-full bg-gradient-to-r ${
                      phase === 'mvp'
                        ? 'from-amber-500'
                        : phase === 'v1.2'
                          ? 'from-slate-500 opacity-70'
                          : 'from-purple-500 opacity-70'
                    } to-transparent`}
                  />
                  <h2 className={`text-xl font-semibold ${config.textColor} md:text-2xl`}>{config.label}</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {phaseBadges.map((badge, index) => (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                      <BadgeCard badge={badge} phase={phase} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </section>

      {/* Progress Info */}
      <section>
        <BadgeProgressInfo userRole="brand" />
      </section>
    </div>
  )
}

