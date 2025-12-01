'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BadgeCheck, Instagram, Youtube, Video, Activity, Filter, ArrowUpDown, Lock, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import BadgeDisplay from '@/components/badges/BadgeDisplay'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS, type InfluencerCategoryKey, getCategoryLabel } from '@/utils/categories'
import type { PlatformType } from '@/components/showcase/ProfileCard'

export interface DiscoverInfluencer {
  id: string
  full_name: string | null
  username: string | null
  category: string | null
  avatar_url: string | null
  spotlight_active: boolean | null
  displayed_badges?: string[] | null
  verification_status?: 'pending' | 'verified' | 'rejected' | null
  // New fields
  platform?: PlatformType
  stats?: {
    followers: string
    engagement: string
    avg_likes?: string
    avg_views?: string
    avg_comments?: string
  }
}

const CATEGORY_OPTIONS = ['All', ...INFLUENCER_CATEGORY_KEYS] as const
const SORT_OPTIONS = [
  { label: 'Önerilen', value: 'recommended' },
  { label: 'En Çok Takipçi', value: 'followers_desc' },
  { label: 'En Az Takipçi', value: 'followers_asc' },
  { label: 'En Yüksek Etkileşim', value: 'engagement_desc' },
  { label: 'En Düşük Etkileşim', value: 'engagement_asc' },
] as const

interface BrandDiscoverGridProps {
  influencers: DiscoverInfluencer[]
  currentUserId?: string
}

export default function BrandDiscoverGrid({ influencers, currentUserId }: BrandDiscoverGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [verifiedAccountsOnly, setVerifiedAccountsOnly] = useState(false)
  const [sortBy, setSortBy] = useState<string>('recommended')
  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [isFiltersOpen, setIsFiltersOpen] = useState(true)

  const filteredInfluencers = useMemo(() => {
    let result = influencers.filter((influencer) => {
      const matchesCategory = selectedCategory === 'All' || influencer.category?.toLowerCase() === selectedCategory.toLowerCase()
      const matchesSearch = searchQuery === '' ||
        (influencer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (influencer.username?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)

      const hasStats = influencer.stats && influencer.stats.followers !== '0'
      const matchesVerifiedData = !verifiedOnly || hasStats
      const matchesVerifiedAccount = !verifiedAccountsOnly || influencer.verification_status === 'verified'

      return matchesCategory && matchesSearch && matchesVerifiedData && matchesVerifiedAccount
    })

    // Sorting Logic
    if (sortBy !== 'recommended') {
      result.sort((a, b) => {
        const getFollowers = (inf: DiscoverInfluencer) => parseInt(inf.stats?.followers || '0')
        const getEngagement = (inf: DiscoverInfluencer) => parseFloat(inf.stats?.engagement?.replace('%', '') || '0')

        switch (sortBy) {
          case 'followers_desc':
            return getFollowers(b) - getFollowers(a)
          case 'followers_asc':
            return getFollowers(a) - getFollowers(b)
          case 'engagement_desc':
            return getEngagement(b) - getEngagement(a)
          case 'engagement_asc':
            return getEngagement(a) - getEngagement(b)
          default:
            return 0
        }
      })
    }

    return result
  }, [influencers, selectedCategory, searchQuery, verifiedOnly, verifiedAccountsOnly, sortBy])

  const filteredCategories = useMemo(() => {
    return CATEGORY_OPTIONS.filter(cat =>
      cat === 'All' ||
      INFLUENCER_CATEGORIES[cat as InfluencerCategoryKey].toLowerCase().includes(categorySearchQuery.toLowerCase())
    )
  }, [categorySearchQuery])

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Filters */}
      <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
        <div className="rounded-3xl border border-white/10 bg-[#0F1014] p-6 shadow-glow transition-all duration-300">
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="flex w-full items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-soft-gold" />
              <h2 className="text-lg font-semibold text-white">Filtrele</h2>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isFiltersOpen ? 'rotate-180' : ''} group-hover:text-white`}
            />
          </button>

          <AnimatePresence>
            {isFiltersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-6 pt-6">
                  {/* Search */}
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-gray-400">Arama</label>
                    <input
                      type="text"
                      placeholder="İsim veya kullanıcı adı..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-soft-gold/50 focus:bg-white/10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3">
                    {/* Verified Data Only Toggle */}
                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
                      <span className="text-sm text-gray-300">Sadece Verisi Olanlar</span>
                      <button
                        onClick={() => setVerifiedOnly(!verifiedOnly)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${verifiedOnly ? 'bg-soft-gold' : 'bg-gray-700'}`}
                      >
                        <span
                          className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${verifiedOnly ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>

                    {/* Verified Accounts Only Toggle */}
                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-300">Onaylı Hesaplar</span>
                      </div>
                      <button
                        onClick={() => setVerifiedAccountsOnly(!verifiedAccountsOnly)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${verifiedAccountsOnly ? 'bg-blue-500' : 'bg-gray-700'}`}
                      >
                        <span
                          className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${verifiedAccountsOnly ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-gray-400">Kategori</label>

                    {/* Category Search */}
                    <input
                      type="text"
                      placeholder="Kategori ara..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none transition focus:border-soft-gold/50 focus:bg-white/10 mb-2"
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                    />

                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {filteredCategories.map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`flex items-center justify-between rounded-xl px-4 py-2 text-sm transition-all ${selectedCategory === category
                            ? 'bg-soft-gold/10 text-soft-gold border border-soft-gold/20'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                        >
                          <span>{category === 'All' ? 'Tümü' : INFLUENCER_CATEGORIES[category as InfluencerCategoryKey]}</span>
                          {selectedCategory === category && <div className="h-1.5 w-1.5 rounded-full bg-soft-gold" />}
                        </button>
                      ))}
                      {filteredCategories.length === 0 && (
                        <p className="text-xs text-gray-500 text-center py-2">Kategori bulunamadı.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Top Bar: Results Count & Sorting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/5 px-6 py-4">
          <p className="text-sm text-gray-400">
            <span className="font-semibold text-white">{filteredInfluencers.length}</span> sonuç bulundu
          </p>

          <div className="flex items-center gap-3">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-sm font-medium text-white outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#0F1014] text-gray-300">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredInfluencers.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
            Seçilen kriterler için influencer bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredInfluencers.map((influencer) => {
              const username = influencer.username || influencer.id
              const isSpotlight = influencer.spotlight_active === true
              const hasStats = influencer.stats && influencer.stats.followers !== '0'

              return (
                <Link key={influencer.id} href={`/profile/${username}`} prefetch={true} className="group cursor-pointer">
                  <article
                    className={`flex h-full flex-col rounded-[32px] border p-4 transition duration-300 ease-out hover:-translate-y-1 ${isSpotlight
                      ? 'border-purple-500/60 bg-[#0B0C10]/60 shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:border-purple-400 hover:shadow-[0_0_35px_rgba(168,85,247,0.6)]'
                      : 'border-white/5 bg-[#1A1B23] hover:border-white/10 hover:shadow-lg'
                      }`}
                  >
                    {/* Image Section */}
                    <div className={`relative aspect-[4/3] w-full flex-shrink-0 overflow-hidden rounded-2xl bg-[#111218] ${isSpotlight ? 'border border-purple-500/30' : ''}`}>
                      {influencer.avatar_url ? (
                        <Image
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          src={influencer.avatar_url}
                          alt={influencer.full_name ?? 'Influencer'}
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                          Fotoğraf yok
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="mt-5 flex flex-1 flex-col">
                      {/* Name & Category Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="truncate text-lg font-bold text-white">
                              {influencer.full_name}
                            </h3>
                            {influencer.verification_status === 'verified' && (
                              <BadgeCheck className="h-4 w-4 flex-shrink-0 text-blue-500" />
                            )}
                          </div>
                          <p className="truncate text-sm font-medium text-soft-gold">
                            @{influencer.username}
                          </p>
                        </div>

                        {influencer.category && (
                          <span className="flex-shrink-0 rounded-xl bg-[#25262E] px-3 py-1.5 text-[10px] font-medium text-gray-300">
                            {getCategoryLabel(influencer.category)}
                          </span>
                        )}
                      </div>

                      {/* Badges Row */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {influencer.displayed_badges && Array.isArray(influencer.displayed_badges) && (
                          <BadgeDisplay
                            badgeIds={influencer.displayed_badges.filter((id): id is string => typeof id === 'string' && id.length > 0)}
                            userRole="influencer"
                            size="small"
                            maxDisplay={2}
                          />
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#111218] p-3">
                        {hasStats ? (
                          <>
                            <div className="text-center">
                              <p className="text-[10px] uppercase tracking-wider text-gray-500">Takipçi</p>
                              <p className="font-bold text-white">{influencer.stats?.followers}</p>
                            </div>
                            <div className="text-center border-l border-white/5">
                              <p className="text-[10px] uppercase tracking-wider text-gray-500">Etkileşim</p>
                              <p className="font-bold text-soft-gold">{influencer.stats?.engagement}</p>
                            </div>
                            <div className="text-center border-t border-white/5 pt-2">
                              <p className="text-[10px] uppercase tracking-wider text-gray-500">Ort. Beğeni</p>
                              <p className="font-bold text-white">{influencer.stats?.avg_likes || '-'}</p>
                            </div>
                            <div className="text-center border-t border-l border-white/5 pt-2">
                              <p className="text-[10px] uppercase tracking-wider text-gray-500">Ort. Yorum</p>
                              <p className="font-bold text-white">{influencer.stats?.avg_comments || '-'}</p>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 flex flex-col items-center justify-center py-4 text-center">
                            <Lock className="mb-2 h-5 w-5 text-gray-600" />
                            <p className="text-xs font-medium text-gray-500">Doğrulanmadı</p>
                          </div>
                        )}
                      </div>

                      {/* Data Source Footer */}
                      <div className="mt-3 text-center">
                        <p className="text-[9px] text-gray-600">
                          {hasStats ? 'Veriler son 12 gönderiye dayanmaktadır.' : 'Veri bulunamadı.'}
                        </p>
                      </div>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
