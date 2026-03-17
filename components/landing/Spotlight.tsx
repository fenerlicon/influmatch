'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { BadgeCheck, ChevronLeft, ChevronRight, Users, Zap } from 'lucide-react'
import { getCategoryLabel } from '@/utils/categories'

export interface SpotlightInfluencer {
  id: string
  full_name: string | null
  username: string | null
  category: string | null
  city: string | null
  avatar_url: string | null
  spotlight_active: boolean
  follower_count: number | null
  engagement_rate: number | null
  has_verified_badge: boolean
}

interface SpotlightProps {
  influencers: SpotlightInfluencer[]
}

export default function Spotlight({ influencers }: SpotlightProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const visibleCount = 4
  const total = influencers.length

  const startAutoplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total)
    }, 3500)
  }

  useEffect(() => {
    if (!isPaused && total > 0) startAutoplay()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPaused, total])

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total)
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 6000)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % total)
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 6000)
  }

  // Create a circular window of visibleCount items starting at currentIndex
  const visibleInfluencers = Array.from({ length: Math.min(visibleCount, total) }, (_, i) => {
    const idx = (currentIndex + i) % total
    return { ...influencers[idx], _displayIndex: i }
  })

  if (total === 0) return null

  return (
    <section
      id="spotlight"
      className="relative px-6 py-16 md:px-12 lg:px-24 xl:px-32"
    >
      <div className="absolute inset-0 -z-10 rounded-[48px] bg-gradient-to-b from-white/5 via-transparent to-transparent blur-3xl" />
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-soft-gold/80">
              Platformumuzdan
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
              <span className="text-soft-gold">Gerçek</span> influencerlar
            </h2>
            <p className="mt-3 max-w-2xl text-base text-gray-300">
              Platforma kayıtlı ve Instagram verileri doğrulanmış influencerlardan bir kesit.
            </p>
          </div>

          {/* Navigation arrows */}
          {total > visibleCount && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:border-soft-gold/50 hover:bg-white/10 hover:text-soft-gold"
                aria-label="Önceki"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xs text-gray-500 tabular-nums">
                {currentIndex + 1} / {total}
              </span>
              <button
                onClick={handleNext}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:border-soft-gold/50 hover:bg-white/10 hover:text-soft-gold"
                aria-label="Sonraki"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleInfluencers.map((influencer, i) => {
            const isActive = i === 0
            const displayName = influencer.full_name || influencer.username || 'İsimsiz'
            const displayUsername = influencer.username ? `@${influencer.username}` : ''
            const followers = influencer.follower_count
              ? influencer.follower_count >= 1000000
                ? `${(influencer.follower_count / 1000000).toFixed(1)}M`
                : influencer.follower_count >= 1000
                  ? `${(influencer.follower_count / 1000).toFixed(0)}K`
                  : String(influencer.follower_count)
              : null
            const engagementStr = influencer.engagement_rate
              ? `%${Number(influencer.engagement_rate).toFixed(1)}`
              : null

            return (
              <Link
                key={`${influencer.id}-${i}`}
                href="/signup-role"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                className={`group relative rounded-3xl border bg-white/5 p-5 transition duration-300 hover:bg-white/10 ${
                  isActive
                    ? 'border-soft-gold/50 ring-1 ring-soft-gold/30 shadow-glow-sm'
                    : 'border-white/5 hover:border-soft-gold/40'
                }`}
              >
                {/* Spotlight badge */}
                {influencer.spotlight_active && (
                  <div className="absolute -top-2.5 left-4 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-soft-gold px-2.5 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider shadow">
                      <Zap className="h-2.5 w-2.5 fill-current" />
                      Vitrin
                    </span>
                  </div>
                )}

                {/* Avatar */}
                <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-black/30">
                  {influencer.avatar_url ? (
                    <Image
                      src={influencer.avatar_url}
                      alt={displayName}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 45vw, 25vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-soft-gold/30">
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold text-soft-gold backdrop-blur-sm">
                      ● Öne Çıkan
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-base font-semibold text-white">
                        {displayName}
                      </p>
                      {influencer.has_verified_badge && (
                        <BadgeCheck className="h-4 w-4 flex-shrink-0 text-blue-400" />
                      )}
                    </div>
                    {displayUsername && (
                      <p className="truncate text-sm text-soft-gold/80">{displayUsername}</p>
                    )}
                  </div>
                  {influencer.category && (
                    <span className="flex-shrink-0 rounded-full bg-black/30 px-2.5 py-1 text-[11px] text-gray-300">
                      {getCategoryLabel(influencer.category)}
                    </span>
                  )}
                </div>

                {/* Stats Row */}
                {(followers || engagementStr || influencer.city) && (
                  <div className="mt-3 rounded-2xl bg-black/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                      {followers && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span className="font-medium text-white">{followers}</span>
                        </div>
                      )}
                      {engagementStr && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">Etkileşim</span>
                          <span className="font-semibold text-soft-gold">{engagementStr}</span>
                        </div>
                      )}
                      {influencer.city && (
                        <span className="truncate text-gray-500">📍 {influencer.city}</span>
                      )}
                    </div>
                  </div>
                )}
              </Link>
            )
          })}
        </div>

        {/* Dot indicators */}
        {total > visibleCount && (
          <div className="mt-8 flex justify-center gap-1.5">
            {Array.from({ length: Math.min(total, 12) }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIndex(i); setIsPaused(true); setTimeout(() => setIsPaused(false), 6000) }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentIndex % Math.min(total, 12)
                    ? 'w-6 bg-soft-gold'
                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`${i + 1}. influencer`}
              />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/signup-role"
            className="inline-flex items-center gap-2 rounded-full border border-soft-gold/30 bg-soft-gold/10 px-6 py-2.5 text-sm font-medium text-soft-gold transition hover:bg-soft-gold/20"
          >
            Tüm influencerları keşfet →
          </Link>
        </div>
      </div>
    </section>
  )
}
