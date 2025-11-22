'use client'

import { motion } from 'framer-motion'
import { Users, Building2 } from 'lucide-react'

interface BadgeToggleProps {
  activeTab: 'influencer' | 'brand'
  onTabChange: (tab: 'influencer' | 'brand') => void
}

export default function BadgeToggle({ activeTab, onTabChange }: BadgeToggleProps) {
  return (
    <div className="relative mx-auto flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => onTabChange('influencer')}
        className={`relative z-10 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors md:px-8 md:py-3.5 md:text-base ${
          activeTab === 'influencer' ? 'text-soft-gold' : 'text-gray-400'
        }`}
      >
        <Users className="h-4 w-4 md:h-5 md:w-5" />
        <span>Influencer Rozetleri</span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange('brand')}
        className={`relative z-10 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors md:px-8 md:py-3.5 md:text-base ${
          activeTab === 'brand' ? 'text-soft-gold' : 'text-gray-400'
        }`}
      >
        <Building2 className="h-4 w-4 md:h-5 md:w-5" />
        <span>Marka Rozetleri</span>
      </button>

      {/* Animated Background */}
      <motion.div
        layout
        className="absolute inset-y-1.5 rounded-xl border border-soft-gold/40 bg-gradient-to-r from-soft-gold/20 to-amber-500/10 shadow-[0_0_20px_rgba(212,175,55,0.4)] backdrop-blur-sm"
        initial={false}
        animate={{
          left: activeTab === 'influencer' ? '0.375rem' : '50%',
          right: activeTab === 'influencer' ? '50%' : '0.375rem',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      />
    </div>
  )
}

