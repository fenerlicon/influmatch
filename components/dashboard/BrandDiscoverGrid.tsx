'use client'

import { useMemo, useState } from 'react'
import { Filter, ArrowUpDown, ChevronDown, BadgeCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS, type InfluencerCategoryKey } from '@/utils/categories'
import { type DiscoverInfluencer } from '@/types/influencer'
import InfluencerGridCard from '@/components/dashboard/InfluencerGridCard'

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
  initialFavoritedIds?: string[]
  userRole?: string
}

export default function BrandDiscoverGrid({ influencers, currentUserId, initialFavoritedIds = [], userRole }: BrandDiscoverGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [verifiedAccountsOnly, setVerifiedAccountsOnly] = useState(false)
  const [sortBy, setSortBy] = useState<string>('recommended')
  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [isFiltersOpen, setIsFiltersOpen] = useState(true)

  const favoritedSet = useMemo(() => new Set(initialFavoritedIds), [initialFavoritedIds])
  // ...

  const filteredInfluencers = useMemo(() => {
    // ... existing filtering logic (omitted for brevity, keep same)
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
    // ... sorting logic ...
    if (sortBy !== 'recommended') {
      result.sort((a, b) => {
        const getFollowers = (inf: DiscoverInfluencer) => parseInt(inf.stats?.followers || '0')
        const getEngagement = (inf: DiscoverInfluencer) => parseFloat(inf.stats?.engagement?.replace('%', '') || '0')
        switch (sortBy) {
          case 'followers_desc': return getFollowers(b) - getFollowers(a)
          case 'followers_asc': return getFollowers(a) - getFollowers(b)
          case 'engagement_desc': return getEngagement(b) - getEngagement(a)
          case 'engagement_asc': return getEngagement(a) - getEngagement(b)
          default: return 0
        }
      })
    }
    return result
  }, [influencers, selectedCategory, searchQuery, verifiedOnly, verifiedAccountsOnly, sortBy])

  // ... filteredCategories ...
  const filteredCategories = useMemo(() => {
    return CATEGORY_OPTIONS.filter(cat =>
      cat === 'All' ||
      INFLUENCER_CATEGORIES[cat as InfluencerCategoryKey].toLowerCase().includes(categorySearchQuery.toLowerCase())
    )
  }, [categorySearchQuery])


  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ... Sidebar ... */}
      {/* I am relying on the tool to replace correctly, but since I am replacing a huge chunk to be safe or just the props? 
            Actually, the instruction says replace EndLine 230 depending on context. 
            Wait, I should only replace the start and the specific card rendering part to minimize risk.
            But the tool replaces a block. 
            Let's do two edits or one big one.
            The user only cares about the restriction.
            Since I need to update Props interface AND the JSX usage, I'll do two chunks if possible or one if close.
            They are far apart (Line 23 and Line 228).
            MultiReplaceFileContent is better.
        */}
      {userRole === 'brand' && (
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
      )}

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* ... */}
        {/* ... */}
        {filteredInfluencers.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
            Seçilen kriterler için influencer bulunamadı.
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 ${userRole === 'brand' ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
            {filteredInfluencers.map((influencer) => {
              return (
                <InfluencerGridCard
                  key={influencer.id}
                  influencer={influencer}
                  initialIsFavorited={favoritedSet.has(influencer.id)}
                  userRole={userRole}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
