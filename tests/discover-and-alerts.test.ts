import { describe, expect, it } from 'vitest'
import {
  canonicalCity,
  hasActiveFilters,
  matchesDiscoverFilters,
  parseDiscoverFilters,
  sortDiscoverProfiles,
  type FilterableProfile,
} from '@/lib/discover-filters'
import { advertBudgetTop, advertMatchesAlert, normalizeText, type AlertableAdvert } from '@/lib/advert-alerts-shared'
import { busyLast, effectiveAvailability, istanbulToday } from '@/lib/availability-shared'

const p = (over: Partial<FilterableProfile> = {}): FilterableProfile => ({
  city: 'İstanbul',
  creator_type: 'influencer',
  displayed_badges: [],
  spotlight_active: false,
  availability_status: 'open',
  accounts: [{ platform: 'instagram', follower_count: 20_000, engagement_rate: 3 }],
  ...over,
})

describe('keşif filtreleri', () => {
  it('şehri Türkçe büyük/küçük harften bağımsız tanır', () => {
    expect(canonicalCity('istanbul')).toBe('İstanbul')
    expect(canonicalCity('IZMIR')).toBeNull() // "I" Türkçede "ı" olur; listede "İzmir"
    expect(canonicalCity('izmir')).toBe('İzmir')
    expect(canonicalCity('Atlantis')).toBeNull()
  })

  it('sorgu parametrelerini güvenli okur', () => {
    const f = parseDiscoverFilters(new URLSearchParams('platform=x&minFollowers=-5&minEngagement=500&sort=hack&withData=1'))
    expect(f.platform).toBeNull()
    expect(f.minEngagement).toBe(100)
    expect(f.sort).toBeNull()
    expect(f.withData).toBe(true)
    expect(hasActiveFilters(parseDiscoverFilters(new URLSearchParams('sort=followers_desc')))).toBe(false)
  })

  it('aralıklar aynı hesapta sağlanmalı', () => {
    const profile = p({
      accounts: [
        { platform: 'instagram', follower_count: 50_000, engagement_rate: 0.5 },
        { platform: 'tiktok', follower_count: 1_000, engagement_rate: 8 },
      ],
    })
    expect(matchesDiscoverFilters(profile, { minFollowers: 10_000, minEngagement: 3 })).toBe(false)
    expect(matchesDiscoverFilters(profile, { minFollowers: 10_000 })).toBe(true)
    expect(matchesDiscoverFilters(profile, { platform: 'tiktok', minEngagement: 3 })).toBe(true)
  })

  it('UGC, mavi tik ve müsaitlik filtreleri', () => {
    expect(matchesDiscoverFilters(p({ creator_type: 'both' }), { creatorType: 'ugc' })).toBe(true)
    expect(matchesDiscoverFilters(p({ creator_type: 'ugc' }), { creatorType: 'influencer' })).toBe(false)
    expect(matchesDiscoverFilters(p(), { blueTick: true })).toBe(false)
    expect(matchesDiscoverFilters(p({ availability_status: 'busy' }), { availableOnly: true })).toBe(false)
  })

  it('sıralama: dolu profiller sonda, sonra Spotlight, sonra ölçüt', () => {
    const items = [
      { id: 'busy', ...p({ availability_status: 'busy', accounts: [{ platform: 'instagram', follower_count: 900_000, engagement_rate: 1 }] }) },
      { id: 'small', ...p({ accounts: [{ platform: 'instagram', follower_count: 1_000, engagement_rate: 1 }] }) },
      { id: 'big', ...p({ accounts: [{ platform: 'instagram', follower_count: 90_000, engagement_rate: 1 }] }) },
      { id: 'spot', ...p({ spotlight_active: true, accounts: [{ platform: 'instagram', follower_count: 500, engagement_rate: 1 }] }) },
    ]
    const sorted = sortDiscoverProfiles(items, { sort: 'followers_desc' }, (x) => x).map((x) => x.id)
    expect(sorted).toEqual(['spot', 'big', 'small', 'busy'])
    const unsorted = sortDiscoverProfiles(items, {}, (x) => x).map((x) => x.id)
    expect(unsorted).toEqual(['small', 'big', 'spot', 'busy'])
  })
})

describe('müsaitlik', () => {
  it('bitiş tarihi geçen "dolu" durumu "iş alıyorum" olur', () => {
    expect(effectiveAvailability({ availability_status: 'busy', availability_until: '2000-01-01' }).status).toBe('open')
    expect(effectiveAvailability({ availability_status: 'busy', availability_until: istanbulToday() }).status).toBe('busy')
    expect(effectiveAvailability({ availability_status: 'busy', availability_until: null }).status).toBe('busy')
    expect(effectiveAvailability(null).status).toBe('open')
  })

  it('İstanbul saatiyle gün döner', () => {
    // 21:30 UTC = İstanbul'da ertesi gün 00:30
    expect(istanbulToday(new Date('2026-10-16T21:30:00Z'))).toBe('2026-10-17')
  })

  it('busyLast sırayı korur', () => {
    expect(busyLast([1, 2, 3, 4], (n) => n % 2 === 1)).toEqual([2, 4, 1, 3])
  })
})

describe('ilan alarmı', () => {
  const advert = (over: Partial<AlertableAdvert> = {}): AlertableAdvert => ({
    category: 'beauty',
    title: 'Yeni cilt bakım serisi için Reels',
    platforms: ['Instagram', 'TikTok'],
    budget_min: 5_000,
    budget_max: 15_000,
    ...over,
  })

  it('metni sadeleştirir', () => {
    expect(normalizeText('  İnstagram! ')).toBe('instagram')
    expect(normalizeText('Çiçek Işık')).toBe('cicek isik')
  })

  it('üst bütçeyi seçer', () => {
    expect(advertBudgetTop(advert())).toBe(15_000)
    expect(advertBudgetTop(advert({ budget_max: null }))).toBe(5_000)
    expect(advertBudgetTop(advert({ budget_max: null, budget_min: null }))).toBeNull()
  })

  it('boş alarm her ilana uyar', () => {
    expect(advertMatchesAlert(advert(), { category: null, platform: null, min_budget: null })).toBe(true)
  })

  it('kategori, kelime, platform ve bütçe', () => {
    const base = { category: null, platform: null, min_budget: null }
    expect(advertMatchesAlert(advert(), { ...base, category_key: 'beauty' })).toBe(true)
    expect(advertMatchesAlert(advert(), { ...base, category_key: 'gaming' })).toBe(false)
    expect(advertMatchesAlert(advert(), { ...base, category: 'CİLT' })).toBe(true)
    expect(advertMatchesAlert(advert(), { ...base, platform: 'tiktok' })).toBe(true)
    expect(advertMatchesAlert(advert(), { ...base, platform: 'youtube' })).toBe(false)
    expect(advertMatchesAlert(advert(), { ...base, min_budget: 15_000 })).toBe(true)
    expect(advertMatchesAlert(advert(), { ...base, min_budget: 15_001 })).toBe(false)
    expect(advertMatchesAlert(advert({ budget_min: null, budget_max: null }), { ...base, min_budget: 1 })).toBe(false)
  })
})
