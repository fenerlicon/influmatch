// Keşif filtreleri (web keşif ızgarası + mobil Keşfet / /api/mobile/discover, 2026-10-14).
// Tek kural iki yerde kullanılır: web ızgarası zaten yetkili listeyi (çark kuralı uygulanmış) istemcide süzer,
// mobil liste sunucuda lib/profile-reads.ts listDiscoverProfiles içinde süzülür. Filtreler yalnızca daraltır;
// görülebilecek profil kümesini (onay, keşif çarkı) genişletmez.
//
// Bu dosya hem sunucuda hem istemcide çalışır (sunucu bağımlılığı yok).

import { TURKISH_CITIES } from '@/utils/turkishCities'

export type DiscoverSort = 'followers_desc' | 'followers_asc' | 'engagement_desc'
export type DiscoverPlatform = 'instagram' | 'tiktok'
export type DiscoverCreatorType = 'influencer' | 'ugc'

export interface DiscoverFilters {
  city?: string | null
  platform?: DiscoverPlatform | null
  creatorType?: DiscoverCreatorType | null
  minFollowers?: number | null
  maxFollowers?: number | null
  /** Etkileşim oranı, yüzde (ör. 2.5 = %2,5). */
  minEngagement?: number | null
  maxEngagement?: number | null
  /** Spotlight Pro filtreleri (sunucu Pro olmayan izleyicide yok sayar). */
  withData?: boolean
  blueTick?: boolean
  /** "Yalnızca iş alanlar": "Şu an dolu" profilleri gizler (3.19). */
  availableOnly?: boolean
  /**
   * "Bütçem" (₺, yalnızca marka): fiyat kartında en az bir başlangıç fiyatı bu tutara sığanlar kalır. Fiyat kartı gerektiği için
   * yalnızca sunucuda (lib/profile-reads.ts listDiscoverProfiles) uygulanır; matchesDiscoverFilters bakmaz (3.14-S2).
   */
  budget?: number | null
  sort?: DiscoverSort | null
}

export interface FilterableAccount {
  platform: string
  follower_count: number | null
  engagement_rate: number | string | null
}

export interface FilterableProfile {
  city?: string | null
  creator_type?: string | null
  displayed_badges?: string[] | null
  spotlight_active?: boolean | null
  /** Geçerli müsaitlik (lib/availability-shared.ts effectiveAvailability); yoksa "iş alıyorum" sayılır. */
  availability_status?: 'open' | 'busy' | null
  accounts: FilterableAccount[]
}

const SORTS: DiscoverSort[] = ['followers_desc', 'followers_asc', 'engagement_desc']
const MAX_FOLLOWERS = 1_000_000_000

function lowerTr(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR')
}

/** Şehir adını listedeki yazımına çevirir ("istanbul" → "İstanbul"); listede yoksa null. */
export function canonicalCity(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const key = lowerTr(value)
  return TURKISH_CITIES.find((city) => lowerTr(city) === key) ?? null
}

function cleanNumber(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(n, max)
}

function numberOf(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Sorgu parametrelerinden (mobil uç) güvenli filtre nesnesi. Bilinmeyen değerler yok sayılır. */
export function parseDiscoverFilters(params: URLSearchParams): DiscoverFilters {
  const platform = params.get('platform')
  const creatorType = params.get('creatorType')
  const sort = params.get('sort') as DiscoverSort | null
  return {
    city: canonicalCity(params.get('city')),
    platform: platform === 'instagram' || platform === 'tiktok' ? platform : null,
    creatorType: creatorType === 'influencer' || creatorType === 'ugc' ? creatorType : null,
    minFollowers: cleanNumber(params.get('minFollowers'), MAX_FOLLOWERS),
    maxFollowers: cleanNumber(params.get('maxFollowers'), MAX_FOLLOWERS),
    minEngagement: cleanNumber(params.get('minEngagement'), 100),
    maxEngagement: cleanNumber(params.get('maxEngagement'), 100),
    withData: params.get('withData') === '1',
    blueTick: params.get('blueTick') === '1',
    availableOnly: params.get('availableOnly') === '1',
    budget: cleanNumber(params.get('budget'), 100_000_000) || null,
    sort: sort && SORTS.includes(sort) ? sort : null,
  }
}

/** Liste kümesini daraltan bir filtre var mı (sıralama hariç). */
export function hasActiveFilters(filters: DiscoverFilters): boolean {
  return Boolean(
    filters.city ||
      filters.platform ||
      filters.creatorType ||
      filters.minFollowers != null ||
      filters.maxFollowers != null ||
      filters.minEngagement != null ||
      filters.maxEngagement != null ||
      filters.withData ||
      filters.blueTick ||
      filters.availableOnly ||
      (filters.budget ?? 0) > 0,
  )
}

/** Platform filtresine uyan hesaplar (platform seçilmemişse hepsi). */
function relevantAccounts(profile: FilterableProfile, filters: DiscoverFilters) {
  return filters.platform ? profile.accounts.filter((a) => a.platform === filters.platform) : profile.accounts
}

export function matchesDiscoverFilters(profile: FilterableProfile, filters: DiscoverFilters): boolean {
  if (filters.city && canonicalCity(profile.city) !== canonicalCity(filters.city)) return false
  if (filters.creatorType === 'influencer' && profile.creator_type === 'ugc') return false
  if (filters.creatorType === 'ugc' && profile.creator_type !== 'ugc' && profile.creator_type !== 'both') return false
  if (filters.blueTick && !profile.displayed_badges?.includes('verified-account')) return false
  if (filters.availableOnly && profile.availability_status === 'busy') return false

  const accounts = relevantAccounts(profile, filters)
  if (filters.platform && accounts.length === 0) return false
  if (filters.withData && !accounts.some((a) => numberOf(a.follower_count) > 0)) return false

  const { minFollowers, maxFollowers, minEngagement, maxEngagement } = filters
  if (minFollowers == null && maxFollowers == null && minEngagement == null && maxEngagement == null) return true
  // Aralıklar aynı hesapta sağlanmalı (ör. Instagram'da 10 B+ takipçi ve %3+ etkileşim).
  return accounts.some((a) => {
    const followers = numberOf(a.follower_count)
    const engagement = numberOf(a.engagement_rate)
    if (minFollowers != null && followers < minFollowers) return false
    if (maxFollowers != null && followers > maxFollowers) return false
    if (minEngagement != null && engagement < minEngagement) return false
    if (maxEngagement != null && engagement > maxEngagement) return false
    return true
  })
}

function bestMetric(profile: FilterableProfile, filters: DiscoverFilters, key: 'follower_count' | 'engagement_rate') {
  return relevantAccounts(profile, filters).reduce((max, a) => Math.max(max, numberOf(a[key])), 0)
}

/**
 * Sıralama: "Şu an dolu" profiller her zaman sonda (3.19), sonra Spotlight profiller önde (web ile aynı), sonra seçilen ölçüt.
 * Ölçüt yoksa mevcut sıra korunur, yalnızca dolu profiller sona alınır. Yeni dizi döner.
 */
export function sortDiscoverProfiles<T>(items: T[], filters: DiscoverFilters, profileOf: (item: T) => FilterableProfile): T[] {
  const sort = filters.sort
  const isBusy = (p: FilterableProfile) => p.availability_status === 'busy'
  const mapped = items.map((item, index) => ({ item, index, profile: profileOf(item) }))
  return mapped
    .sort((a, b) => {
      if (isBusy(a.profile) !== isBusy(b.profile)) return isBusy(a.profile) ? 1 : -1
      if (!sort) return a.index - b.index
      if (!!a.profile.spotlight_active !== !!b.profile.spotlight_active) return a.profile.spotlight_active ? -1 : 1
      switch (sort) {
        case 'followers_desc':
          return bestMetric(b.profile, filters, 'follower_count') - bestMetric(a.profile, filters, 'follower_count')
        case 'followers_asc':
          return bestMetric(a.profile, filters, 'follower_count') - bestMetric(b.profile, filters, 'follower_count')
        case 'engagement_desc':
          return bestMetric(b.profile, filters, 'engagement_rate') - bestMetric(a.profile, filters, 'engagement_rate')
        default:
          return 0
      }
    })
    .map((x) => x.item)
}
