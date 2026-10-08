// Marka sektörü -> influencer kategorileri eşlemesi (3.5-S2).
// Marka ve influencer kategorileri ayrı listelerden gelir (utils/categories.ts); listeler değiştirilmeden
// öneri sorgusu ve eşleşme puanı bu tablo üzerinden çalışır. İlk eleman birincil kategoridir (tam puan),
// diğerleri ilgili kategorilerdir (kısmi puan). Boş liste: sektör her kategoriyle çalışır (filtre yok).

import { BRAND_CATEGORIES, INFLUENCER_CATEGORIES, type BrandCategoryKey, type InfluencerCategoryKey } from '@/utils/categories'

export const BRAND_TO_INFLUENCER_CATEGORIES: Record<BrandCategoryKey, InfluencerCategoryKey[]> = {
  tech: ['tech', 'gaming', 'business', 'lifestyle'],
  fashion: ['fashion', 'beauty', 'lifestyle'],
  beauty: ['beauty', 'fashion', 'health', 'lifestyle'],
  service: ['lifestyle', 'business', 'home', 'parenting'],
  agency: [],
  gaming: ['gaming', 'tech', 'entertainment'],
  finance: ['business', 'tech', 'lifestyle'],
  food: ['food', 'lifestyle', 'travel', 'parenting'],
  travel: ['travel', 'lifestyle', 'food'],
  health: ['health', 'beauty', 'lifestyle'],
  home: ['home', 'parenting', 'lifestyle'],
  entertainment: ['entertainment', 'gaming', 'lifestyle'],
  automotive: ['automotive', 'tech', 'lifestyle'],
  pets: ['pets', 'lifestyle', 'parenting'],
}

// Eski mobil sürümün yazdığı etiketler (ör. "Moda", "Güzellik") -> anahtar.
const LEGACY_INFLUENCER_LABELS: Record<string, InfluencerCategoryKey> = {
  moda: 'fashion',
  'güzellik': 'beauty',
  teknoloji: 'tech',
  oyun: 'gaming',
  spor: 'health',
  'yaşam': 'lifestyle',
  seyahat: 'travel',
  yemek: 'food',
  sanat: 'entertainment',
  'eğlence': 'entertainment',
}

/** Influencer kategori değerini anahtara çevirir (anahtar, web etiketi veya eski mobil etiketi; virgüllü ise ilki). */
export function normalizeInfluencerCategory(value: string | null | undefined): InfluencerCategoryKey | null {
  if (!value) return null
  const first = value.split(',')[0].trim()
  if (!first) return null
  if (first in INFLUENCER_CATEGORIES) return first as InfluencerCategoryKey
  const lower = first.toLocaleLowerCase('tr-TR')
  const byLabel = (Object.keys(INFLUENCER_CATEGORIES) as InfluencerCategoryKey[]).find(
    (key) => INFLUENCER_CATEGORIES[key].toLocaleLowerCase('tr-TR') === lower,
  )
  return byLabel ?? LEGACY_INFLUENCER_LABELS[lower] ?? null
}

/**
 * Marka kategorisine uyan influencer kategorileri. Marka anahtarı tanınmazsa ve bir influencer
 * kategorisine denk geliyorsa o kullanılır. Boş dizi: filtre uygulanmaz.
 */
export function influencerCategoriesForBrand(brandCategory: string | null | undefined): InfluencerCategoryKey[] {
  if (!brandCategory) return []
  if (brandCategory in BRAND_TO_INFLUENCER_CATEGORIES) {
    return BRAND_TO_INFLUENCER_CATEGORIES[brandCategory as BrandCategoryKey]
  }
  const asInfluencer = normalizeInfluencerCategory(brandCategory)
  return asInfluencer ? [asInfluencer] : []
}

/** Sorguda kullanılacak tüm değerler: anahtarlar + eski mobil etiketleri (ör. "Moda"). */
export function categoryQueryValues(keys: InfluencerCategoryKey[]): string[] {
  const legacy = Object.entries(LEGACY_INFLUENCER_LABELS)
    .filter(([, key]) => keys.includes(key))
    .map(([label]) => label.charAt(0).toLocaleUpperCase('tr-TR') + label.slice(1))
  return Array.from(new Set([...keys, ...legacy]))
}

/** Eşleşme derecesi: birincil kategori 'primary', ilgili kategori 'related', yoksa null. */
export function categoryMatchLevel(
  brandCategory: string | null | undefined,
  influencerCategory: string | null | undefined,
): 'primary' | 'related' | null {
  const targets = influencerCategoriesForBrand(brandCategory)
  const key = normalizeInfluencerCategory(influencerCategory)
  if (!key || targets.length === 0) return null
  if (targets[0] === key) return 'primary'
  return targets.includes(key) ? 'related' : null
}

export function brandCategoryLabel(key: string | null | undefined): string | null {
  if (!key) return null
  return BRAND_CATEGORIES[key as BrandCategoryKey] ?? key
}
