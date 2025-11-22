'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import BadgeCard from '@/components/badges/BadgeCard'
import BadgeToggle from '@/components/badges/BadgeToggle'
import { influencerBadges, brandBadges, phaseConfig, type Badge, type BadgePhase } from './data'

export default function BadgesPage() {
  const [activeTab, setActiveTab] = useState<'influencer' | 'brand'>('influencer')

  const badges = activeTab === 'influencer' ? influencerBadges : brandBadges

  const badgesByPhase = {
    mvp: badges.filter((b) => b.phase === 'mvp'),
    'v1.2': badges.filter((b) => b.phase === 'v1.2'),
    'v1.3': badges.filter((b) => b.phase === 'v1.3'),
  }

  return (
    <main className="min-h-screen bg-[#0C0D10] px-4 py-12 text-white sm:px-8 lg:px-20">
      {/* Hero Section */}
      <section className="relative mx-auto max-w-6xl">
        <div className="absolute inset-0 -z-10 rounded-[48px] bg-gradient-to-b from-soft-gold/10 via-transparent to-transparent blur-3xl" />
        
        <div className="relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-soft-gold/30 bg-soft-gold/10 px-4 py-2">
              <Sparkles className="h-4 w-4 text-soft-gold" />
              <span className="text-xs uppercase tracking-[0.3em] text-soft-gold">Rozet Sistemi</span>
            </div>
            <h1 className="mb-4 text-4xl font-semibold text-white md:text-5xl lg:text-6xl">
              Prestijin Yeni Tanımı:{' '}
              <span className="bg-gradient-to-r from-soft-gold via-amber-300 to-soft-gold bg-clip-text text-transparent">
                Influmatch Rozetleri
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-base leading-relaxed text-gray-300 md:text-lg">
              Rozetler, platformumuzda güveni ve prestiji simgeler. Kimlik doğrulamasından başarı metriklerine kadar,
              her rozet profilinizin görünürlüğünü artırır ve markaların sizi keşfetmesini kolaylaştırır. Algoritmamız,
              rozetli profilleri önceliklendirerek daha fazla işbirliği fırsatı sunar.
            </p>
          </motion.div>

          {/* Abstract Badge Illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mx-auto mt-8 h-32 w-32 md:h-40 md:w-40"
          >
            <div className="absolute inset-0 rounded-full border-2 border-soft-gold/30 bg-gradient-to-br from-soft-gold/20 to-amber-500/10 blur-xl" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full border border-soft-gold/40 bg-gradient-to-br from-soft-gold/10 to-transparent backdrop-blur-sm">
              <Sparkles className="h-12 w-12 text-soft-gold md:h-16 md:w-16" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Toggle Switch */}
      <section className="mx-auto mt-12 max-w-6xl">
        <BadgeToggle activeTab={activeTab} onTabChange={setActiveTab} />
      </section>

      {/* Badges Listing */}
      <section className="mx-auto mt-12 max-w-6xl space-y-12">
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
                  <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${config.borderColor.replace('border-', 'from-').replace('/30', '')} to-transparent`} />
                  <h2 className={`text-xl font-semibold ${config.textColor} md:text-2xl`}>
                    {config.label}
                  </h2>
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
    </main>
  )
}

