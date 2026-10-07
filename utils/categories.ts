// Influencer Categories
// Key-value mapping for categories used throughout the platform

export const INFLUENCER_CATEGORIES = {
  beauty: 'Güzellik & Bakım',
  fashion: 'Moda & Stil',
  lifestyle: 'Yaşam Tarzı',
  food: 'Yeme & İçme',
  travel: 'Seyahat',
  tech: 'Teknoloji',
  gaming: 'Oyun & E-Spor',
  health: 'Sağlık & Spor',
  parenting: 'Anne & Çocuk',
  home: 'Ev & Dekorasyon',
  business: 'Finans & Girişim',
  entertainment: 'Eğlence & Mizah',
  automotive: 'Otomotiv',
  pets: 'Evcil Hayvan',
} as const

export type InfluencerCategoryKey = keyof typeof INFLUENCER_CATEGORIES

// Get category label by key
export function getCategoryLabel(key: string): string {
  return INFLUENCER_CATEGORIES[key as InfluencerCategoryKey] || key
}

// Get category key by label (for reverse lookup)
// Get all category keys as array
export const INFLUENCER_CATEGORY_KEYS = Object.keys(INFLUENCER_CATEGORIES) as InfluencerCategoryKey[]

// Get all category labels as array
// Brand Categories (can be same or different - keeping separate for flexibility)
export const BRAND_CATEGORIES = {
  tech: 'Teknoloji',
  fashion: 'Giyim',
  beauty: 'Kozmetik',
  service: 'Hizmet',
  agency: 'Ajans',
  gaming: 'Oyun',
  finance: 'Finans',
  food: 'Yeme & İçme',
  travel: 'Seyahat',
  health: 'Sağlık & Spor',
  home: 'Ev & Dekorasyon',
  entertainment: 'Eğlence',
  automotive: 'Otomotiv',
  pets: 'Evcil Hayvan',
} as const

export type BrandCategoryKey = keyof typeof BRAND_CATEGORIES

export const BRAND_CATEGORY_KEYS = Object.keys(BRAND_CATEGORIES) as BrandCategoryKey[]
