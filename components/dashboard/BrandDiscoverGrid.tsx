'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import BadgeDisplay from '@/components/badges/BadgeDisplay'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS, type InfluencerCategoryKey, getCategoryLabel } from '@/utils/categories'

export interface DiscoverInfluencer {
  id: string
  full_name: string | null
  username: string | null
  category: string | null
  avatar_url: string | null
  spotlight_active: boolean | null
  displayed_badges?: string[] | null
  verification_status?: 'pending' | 'verified' | 'rejected' | null
}

const CATEGORY_OPTIONS = ['All', ...INFLUENCER_CATEGORY_KEYS] as const

interface BrandDiscoverGridProps {
  influencers: DiscoverInfluencer[]
  currentUserId?: string
}

export default function BrandDiscoverGrid({ influencers, currentUserId }: BrandDiscoverGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('All')

  const filteredInfluencers = useMemo(() => {
    if (selectedCategory === 'All') return influencers
    return influencers.filter(
      (influencer) => influencer.category?.toLowerCase() === selectedCategory.toLowerCase(),
    )
  }, [influencers, selectedCategory])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#0F1014] p-6 text-white shadow-glow md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Filtreler</p>
          <h2 className="mt-2 text-lg font-semibold">Kategori seç</h2>
        </div>
        <label className="flex flex-col text-sm text-gray-300 md:flex-row md:items-center md:gap-3">
          <span>Kategori</span>
          <select
            className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 font-medium text-white outline-none transition hover:border-soft-gold/70 hover:bg-white/10 md:mt-0"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as (typeof CATEGORY_OPTIONS)[number])}
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category} className="bg-[#0F1014] text-white">
                {category === 'All' ? 'Tümü' : INFLUENCER_CATEGORIES[category as InfluencerCategoryKey]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredInfluencers.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
          Seçilen kategori için influencer bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {filteredInfluencers.map((influencer) => {
            const username = influencer.username || influencer.id
            const isCurrentUser = influencer.id === currentUserId
            const isSpotlight = influencer.spotlight_active === true
            return (
              <Link key={influencer.id} href={`/profile/${username}`} prefetch={true} className="group cursor-pointer">
                <article
                  className={`flex h-full flex-col rounded-3xl border p-4 text-white transition duration-300 ease-out hover:-translate-y-1 ${
                    isSpotlight
                      ? 'border-purple-500/60 bg-[#0B0C10] shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:border-purple-400 hover:shadow-[0_0_35px_rgba(168,85,247,0.6)]'
                      : 'border-white/10 bg-[#0B0C10] hover:border-soft-gold/70 hover:shadow-glow'
                  }`}
                >
                  <div
                    className={`relative h-56 w-full flex-shrink-0 overflow-hidden rounded-2xl border ${
                      isSpotlight ? 'border-purple-500/50' : 'border-white/5'
                    }`}
                  >
                    {influencer.avatar_url ? (
                      <Image
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        src={influencer.avatar_url}
                        alt={influencer.full_name ?? 'Influencer'}
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-white/5 to-transparent text-sm text-gray-400">
                        Fotoğraf yok
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-semibold flex items-center gap-2 line-clamp-1">
                          <span className="truncate">{influencer.full_name}</span>
                          {influencer.verification_status === 'verified' && (
                            <div className="group/verify relative flex-shrink-0">
                              <BadgeCheck className="h-5 w-5 text-blue-500 transition-all hover:text-blue-400 hover:scale-110 cursor-pointer" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover/verify:opacity-100 group-hover/verify:visible transition-all duration-200 z-50 pointer-events-none">
                                <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg border border-white/10">
                                  Onaylı hesap
                                  <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-px">
                                    <div className="h-2 w-2 rotate-45 border-r border-b border-white/10 bg-gray-900"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {isCurrentUser ? (
                            <span className="flex-shrink-0 rounded-full border border-soft-gold/40 bg-soft-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-soft-gold">
                              Sen
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-gray-400 truncate">@{influencer.username}</p>
                      </div>
                    </div>
                    {influencer.category && (
                      <div className="flex flex-col gap-2">
                        <span className="flex-shrink-0 self-start rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-gray-300">
                          {getCategoryLabel(influencer.category)}
                        </span>
                        {influencer.displayed_badges && Array.isArray(influencer.displayed_badges) && influencer.displayed_badges.length > 0 && influencer.displayed_badges.filter(Boolean).length > 0 && (
                          <BadgeDisplay
                            badgeIds={influencer.displayed_badges.filter((id): id is string => typeof id === 'string' && id.length > 0)}
                            userRole="influencer"
                            size="small"
                            maxDisplay={3}
                          />
                        )}
                      </div>
                    )}
                    {!influencer.category && influencer.displayed_badges && Array.isArray(influencer.displayed_badges) && influencer.displayed_badges.length > 0 && influencer.displayed_badges.filter(Boolean).length > 0 && (
                      <div className="flex items-center">
                        <BadgeDisplay
                          badgeIds={influencer.displayed_badges.filter((id): id is string => typeof id === 'string' && id.length > 0)}
                          userRole="influencer"
                          size="small"
                          maxDisplay={3}
                        />
                      </div>
                    )}
                  </div>
                </article>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

