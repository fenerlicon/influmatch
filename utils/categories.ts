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

// İlan kategorisi (3.7-S5): influencer kategorilerinden biri ya da "Genel" (her kategoriye açık).
// Veritabanına anahtar yazılır (ör. 'beauty', 'general'); eski serbest metin değerler olduğu gibi gösterilir.
// Mobil kopyası: mobile-app/constants/categories.js.
export const ADVERT_GENERAL_CATEGORY = 'general'

export function isAdvertCategoryKey(value: unknown): value is InfluencerCategoryKey | typeof ADVERT_GENERAL_CATEGORY {
  return typeof value === 'string' && (value === ADVERT_GENERAL_CATEGORY || Object.prototype.hasOwnProperty.call(INFLUENCER_CATEGORIES, value))
}

/** "Genel" ilan (her kategoriye açık). Eşleme uygulanmadan önceki eski 'Genel' metni ve boş değer de sayılır. */
export function isGeneralAdvertCategory(value: string | null | undefined): boolean {
  return !value || value === ADVERT_GENERAL_CATEGORY || value === 'Genel'
}

/** İlan kategorisinin ekrandaki adı ("general" → "Genel", anahtar → etiket, eski metin → kendisi). */
export function advertCategoryLabel(value: string | null | undefined): string {
  if (isGeneralAdvertCategory(value)) return 'Genel'
  return Object.prototype.hasOwnProperty.call(INFLUENCER_CATEGORIES, value as string) ? INFLUENCER_CATEGORIES[value as InfluencerCategoryKey] : (value as string)
}

/** İlan bu influencer kategorisine uyuyor mu (aynı kategori ya da "Genel"). */
export function advertFitsCategory(advertCategory: string | null | undefined, influencerCategory: string | null | undefined): boolean {
  if (!influencerCategory) return false
  return advertCategory === influencerCategory || isGeneralAdvertCategory(advertCategory)
}

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
