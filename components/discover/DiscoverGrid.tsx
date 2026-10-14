'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, BarChart3, Lock, Search, SlidersHorizontal, Users } from 'lucide-react'
import { isProPlan } from '@/lib/subscription-tier'
import { normalizeInfluencerCategory } from '@/lib/category-map'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS, type InfluencerCategoryKey } from '@/utils/categories'
import { calculateMatchScore } from '@/utils/matching'
import type { DiscoverInfluencer } from '@/types/influencer'
import { Button, Card, EmptyState, Input, Segmented, Select } from '@/components/ui'
import { cn } from '@/utils/cn'
import ProfileCard from './ProfileCard'

const PAGE_SIZE = 24

interface Props {
  influencers: DiscoverInfluencer[]
  viewerRole: 'brand' | 'influencer'
  favoritedIds?: string[]
  favoritesLocked?: boolean
  isSpotlightMember?: boolean
  spotlightPlan?: string | null
  /** Marka sektörü ("Önerilen" sıralamasındaki uyum için). */
  defaultCategory?: string | null
  minPrices?: Record<string, number>
  completedCounts?: Record<string, number>
  /** Önerilenler: sunucunun hesapladığı uyum puanı ve nedenleri kartta görünür, sıra korunur. */
  scored?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

function parseStat(val: string | undefined) {
  if (!val) return 0
  const clean = val.toString().toUpperCase().replace(/,/g, '.')
  if (clean.includes('M')) return parseFloat(clean.replace('M', '')) * 1_000_000
  if (clean.includes('K') || clean.includes('B')) return parseFloat(clean.replace(/K|B/g, '')) * 1000
  return parseFloat(clean.replace(/[^0-9.]/g, '')) || 0
}

const hasStats = (inf: DiscoverInfluencer) =>
  (inf.platforms_data ?? []).some((p) => (p.follower_count ?? 0) > 0) || (!!inf.stats?.followers && inf.stats.followers !== '0' && inf.stats.followers !== '0%')

/** Keşif ızgarası: filtre çubuğu + profil kartları (24'er sayfa, kullanıcı kararı 2026-10-09). */
export default function DiscoverGrid({
  influencers,
  viewerRole,
  favoritedIds = [],
  favoritesLocked = false,
  isSpotlightMember = false,
  spotlightPlan,
  defaultCategory,
  minPrices,
  completedCounts,
  scored = false,
  emptyTitle = 'Henüz profil yok',
  emptyDescription,
}: Props) {
  const isBrand = viewerRole === 'brand'
  const isPro = isProPlan(spotlightPlan)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | InfluencerCategoryKey>('all')
  const [platform, setPlatform] = useState<'all' | 'instagram' | 'tiktok'>('all')
  const [creatorType, setCreatorType] = useState<'all' | 'influencer' | 'ugc'>('all')
  const [budgetInput, setBudgetInput] = useState('')
  const [withData, setWithData] = useState(false)
  const [blueOnly, setBlueOnly] = useState(false)
  const [sortBy, setSortBy] = useState(scored ? 'score' : isSpotlightMember && isBrand ? 'recommended' : 'followers_desc')
  const [visible, setVisible] = useState(PAGE_SIZE)
  // Telefonda arama dışındaki filtreler "Filtreler" düğmesinin arkasında.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const budget = Number(budgetInput.replace(/\D/g, '')) || 0
  const favorites = useMemo(() => new Set(favoritedIds), [favoritedIds])
  const target = (category !== 'all' ? category : defaultCategory) || undefined

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    const result = influencers.filter((inf) => {
      if (category !== 'all' && normalizeInfluencerCategory(inf.category) !== category) return false
      if (q && !`${inf.full_name ?? ''} ${inf.username ?? ''}`.toLocaleLowerCase('tr').includes(q)) return false
      if (withData && !hasStats(inf)) return false
      if (blueOnly && !inf.displayed_badges?.includes('verified-account')) return false
      if (platform !== 'all' && !(inf.platforms?.includes(platform) || inf.platform === platform)) return false
      if (creatorType === 'influencer' && inf.creator_type === 'ugc') return false
      if (creatorType === 'ugc' && inf.creator_type !== 'ugc' && inf.creator_type !== 'both') return false
      if (minPrices && budget > 0) {
        const min = minPrices[inf.id]
        if (typeof min !== 'number' || min > budget) return false
      }
      return true
    })
    if (sortBy === 'score') return result
    return result.sort((a, b) => {
      // Spotlight profiller her sıralamada önde.
      if (!!a.spotlight_active !== !!b.spotlight_active) return a.spotlight_active ? -1 : 1
      switch (sortBy) {
        case 'recommended':
          return calculateMatchScore(b, { targetCategory: target }) - calculateMatchScore(a, { targetCategory: target })
        case 'followers_desc':
          return parseStat(b.stats?.followers) - parseStat(a.stats?.followers)
        case 'followers_asc':
          return parseStat(a.stats?.followers) - parseStat(b.stats?.followers)
        case 'engagement_desc':
          return parseStat(b.stats?.engagement) - parseStat(a.stats?.engagement)
        default:
          return 0
      }
    })
  }, [influencers, query, category, withData, blueOnly, platform, creatorType, minPrices, budget, sortBy, target])

  useEffect(() => setVisible(PAGE_SIZE), [query, category, withData, blueOnly, platform, creatorType, budget, sortBy])

  const shown = filtered.slice(0, visible)
  const activeCount = [category !== 'all', platform !== 'all', creatorType !== 'all', budget > 0, withData, blueOnly].filter(Boolean).length

  if (influencers.length === 0) {
    return (
      <Card>
        <EmptyState icon={Users} title={emptyTitle} description={emptyDescription} />
      </Card>
    )
  }

  const proToggle = (on: boolean, set: (v: boolean) => void, label: string, Icon: typeof BadgeCheck) => (
    <button
      type="button"
      aria-pressed={on}
      disabled={!isPro}
      onClick={() => set(!on)}
      title={isPro ? label : `${label}: Spotlight Pro özelliği`}
      className={cn(
        'inline-flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        on ? 'border-gold/30 bg-gold/10 text-ink' : 'border-line-strong bg-surface-1 text-ink-muted hover:text-ink',
      )}
    >
      {isPro ? <Icon className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {label}
    </button>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-[1_1_220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İsim veya @kullanıcı adı" aria-label="Profil ara" className="pl-9" />
        </label>
        <Button className="sm:hidden" leftIcon={<SlidersHorizontal />} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
          Filtreler{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
        <div className={cn('w-full flex-wrap items-center gap-2 sm:contents', filtersOpen ? 'flex' : 'hidden')}>
          <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Kategori" className="w-auto">
            <option value="all">Tüm kategoriler</option>
            {INFLUENCER_CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {INFLUENCER_CATEGORIES[key]}
              </option>
            ))}
          </Select>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} aria-label="Platform" className="w-auto">
            <option value="all">Instagram ve TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </Select>
          {isBrand && minPrices && (
            <Input
              value={budgetInput}
              inputMode="numeric"
              onChange={(e) => setBudgetInput(e.target.value.replace(/[^\d.]/g, '').slice(0, 11))}
              placeholder="Bütçem (₺)"
              aria-label="Bütçem (₺)"
              title="Girersen yalnızca fiyat kartında bu bütçeye sığan başlangıç fiyatı olan profiller kalır."
              className="w-[130px]"
            />
          )}
          <Segmented
            label="Üretici türü"
            value={creatorType}
            onSelect={(v) => setCreatorType(v as typeof creatorType)}
            items={[
              { value: 'all', label: 'Tümü' },
              { value: 'influencer', label: 'Influencer' },
              { value: 'ugc', label: 'UGC' },
            ]}
          />
          {proToggle(withData, setWithData, 'Verisi olanlar', BarChart3)}
          {proToggle(blueOnly, setBlueOnly, 'Mavi tikli', BadgeCheck)}
          {!scored && (
            <label className="ml-auto flex items-center gap-2 text-xs text-ink-faint">
              Sırala
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-8 w-auto text-[12.5px]">
                {isBrand && (
                  <option value="recommended" disabled={!isSpotlightMember}>
                    Önerilen{isSpotlightMember ? '' : ' (Spotlight)'}
                  </option>
                )}
                <option value="followers_desc">En çok takipçi</option>
                <option value="followers_asc">En az takipçi</option>
                <option value="engagement_desc">En yüksek etkileşim</option>
              </Select>
            </label>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Eşleşen profil yok" description="Filtreleri gevşetip tekrar dene." />
        </Card>
      ) : (
        <>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {shown.map((inf) => (
              <ProfileCard
                key={inf.id}
                influencer={inf}
                viewerRole={viewerRole}
                isFavorited={favorites.has(inf.id)}
                favoritesLocked={favoritesLocked}
                isSpotlightMember={isSpotlightMember}
                // Uyum puanı yalnızca Önerilenler'de görünür (tasarım); diğer sekmelerde "Önerilen" yalnızca sıralar.
                matchScore={scored ? inf.matchScore : undefined}
                matchReasons={scored ? inf.matchReasons : undefined}
                startingPrice={minPrices?.[inf.id] ?? null}
                completedCollaborations={completedCounts?.[inf.id] ?? 0}
              />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-faint">
              {filtered.length.toLocaleString('tr-TR')} profilden {shown.length.toLocaleString('tr-TR')} tanesi gösteriliyor
            </span>
            {filtered.length > shown.length && (
              <Button size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Daha fazla göster ({filtered.length - shown.length})
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
