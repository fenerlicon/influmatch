'use client'

import type { Badge, BadgePhase } from '@/app/badges/data'
import { phaseConfig } from '@/app/badges/data'

interface BadgeCardProps {
  badge: Badge
  phase: BadgePhase
}

export default function BadgeCard({ badge, phase }: BadgeCardProps) {
  const config = phaseConfig[phase]
  const Icon = badge.icon

  const getGlowShadow = () => {
    if (phase === 'mvp') return '0 0 20px rgba(245,158,11,0.3)'
    if (phase === 'v1.2') return '0 0 20px rgba(148,163,184,0.2)'
    return '0 0 20px rgba(168,85,247,0.2)'
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${config.borderColor} ${phase === 'mvp' ? 'bg-white/5' : 'bg-white/3'} p-5 backdrop-blur-sm transition-transform hover:scale-[1.02] hover:-translate-y-1 md:p-6`}
    >
      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          boxShadow: getGlowShadow(),
        }}
      />

      <div className="relative z-10 flex items-start gap-4">
        {/* Icon */}
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border ${config.borderColor} ${config.bgColor} ${config.textColor} transition-transform group-hover:scale-110 md:h-14 md:w-14`}
        >
          <Icon className="h-6 w-6 md:h-7 md:w-7" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 text-base font-semibold text-white md:text-lg">{badge.name}</h3>
          <p className="text-xs text-gray-400 md:text-sm">{badge.description}</p>
        </div>
      </div>

      {/* Decorative corner accent */}
      <div
        className={`absolute -right-4 -top-4 h-16 w-16 rounded-full ${config.bgColor} opacity-20 blur-xl`}
      />
    </div>
  )
}
