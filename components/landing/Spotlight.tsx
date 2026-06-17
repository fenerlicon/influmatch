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
  platform?: string | null
  platforms_data?: {
    platform: string
    follower_count: number | null
    engagement_rate: number | null
  }[]
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
              Platforma kayıtlı ve sosyal medya verileri doğrulanmış influencerlardan bir kesit.
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
                {/* Platform badge */}
                {influencer.platform && (
                  <div className="absolute -top-2.5 right-4 z-10">
                    {influencer.platform === 'tiktok' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black border border-[#25F4EE]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#25F4EE] uppercase tracking-wider shadow-[0_0_10px_rgba(37,244,238,0.2)]">
                        <svg className="h-2.5 w-2.5 fill-current text-[#FE2C55]" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
                        </svg>
                        TikTok
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black border border-soft-gold/30 px-2.5 py-0.5 text-[10px] font-bold text-soft-gold uppercase tracking-wider shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                        <svg className="h-2.5 w-2.5 fill-current text-pink-500" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        Instagram
                      </span>
                    )}
                  </div>
                )}

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
                      unoptimized
                      style={{ imageOrientation: 'from-image' }}
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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="truncate text-sm text-soft-gold/80">{displayUsername}</p>
                        {influencer.platform === 'instagram' && (
                          <span className="p-0.5 rounded bg-white/5 text-pink-500" title="Instagram">
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                            </svg>
                          </span>
                        )}
                        {influencer.platform === 'tiktok' && (
                          <span className="p-0.5 rounded bg-white/5 text-[#25F4EE]" title="TikTok">
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {influencer.category && (
                    <span className="flex-shrink-0 rounded-full bg-black/30 px-2.5 py-1 text-[11px] text-gray-300">
                      {getCategoryLabel(influencer.category)}
                    </span>
                  )}
                </div>

                {/* Stats Row */}
                {(((influencer.platforms_data && influencer.platforms_data.length > 0) || followers || engagementStr) || influencer.city) && (
                  <div className="mt-3 rounded-2xl bg-black/20 px-4 py-3 space-y-2">
                    {influencer.platforms_data && influencer.platforms_data.length > 0 ? (
                      influencer.platforms_data.map((plat) => {
                        const platFollowers = plat.follower_count
                          ? plat.follower_count >= 1000000
                            ? `${(plat.follower_count / 1000000).toFixed(1)}M`
                            : plat.follower_count >= 1000
                              ? `${(plat.follower_count / 1000).toFixed(0)}K`
                              : String(plat.follower_count)
                          : '0'
                        const platEngagement = plat.engagement_rate
                          ? `%${Number(plat.engagement_rate).toFixed(1)}`
                          : '-%'
                        const isTikTok = plat.platform === 'tiktok'

                        return (
                          <div key={plat.platform} className="flex items-center justify-between text-xs border-b border-white/5 last:border-0 pb-1.5 last:pb-0">
                            <div className="flex items-center gap-1.5">
                              {isTikTok ? (
                                <span className="p-1 rounded bg-[#25F4EE]/10 text-[#25F4EE]" title="TikTok">
                                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
                                  </svg>
                                </span>
                              ) : (
                                <span className="p-1 rounded bg-pink-500/10 text-pink-500" title="Instagram">
                                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                  </svg>
                                </span>
                              )}
                              <span className="font-semibold text-white">{platFollowers}</span>
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest">Takipçi</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500">Etkileşim:</span>
                              <span className={`font-semibold ${isTikTok ? 'text-[#25F4EE]' : 'text-soft-gold'}`}>{platEngagement}</span>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        {followers && (
                          <div className="flex items-center gap-1.5">
                            {influencer.platform === 'tiktok' ? (
                              <svg className="h-3 w-3 fill-current text-[#25F4EE]" viewBox="0 0 24 24">
                                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
                              </svg>
                            ) : influencer.platform === 'instagram' ? (
                              <svg className="h-3 w-3 fill-current text-pink-500" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                              </svg>
                            ) : (
                              <Users className="h-3 w-3" />
                            )}
                            <span className="font-medium text-white">{followers}</span>
                          </div>
                        )}
                        {engagementStr && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Etkileşim</span>
                            <span className="font-semibold text-soft-gold">{engagementStr}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {influencer.city && (
                      <div className="text-right pt-1.5 text-[10px] text-gray-500 border-t border-white/5">
                        📍 {influencer.city}
                      </div>
                    )}
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
