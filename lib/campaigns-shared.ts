// Kampanya sabitleri ve tipleri (yol haritası özellik 4, 2026-10-14; SYSTEM_MAP 3.19).
// Sunucu ve tarayıcı ortak (sunucuya özel içe aktarım yok). Mobil karşılığı: mobile-app/constants/campaigns.js.

import { DELIVERABLE_KIND_LABELS, DELIVERABLE_KINDS, type DeliverableKind } from '@/lib/collaboration-workspace-shared'
import type { Availability } from '@/lib/availability-shared'

export { DELIVERABLE_KIND_LABELS, DELIVERABLE_KINDS, type DeliverableKind }

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived'
export const CAMPAIGN_STATUSES: CampaignStatus[] = ['draft', 'active', 'completed', 'archived']
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  completed: 'Tamamlandı',
  archived: 'Arşiv',
}
/** Davet gönderilebilen / teklif ve ilan bağlanabilen durumlar. */
export const CAMPAIGN_OPEN_STATUSES: CampaignStatus[] = ['draft', 'active']

export type CampaignPlatform = 'instagram' | 'tiktok'
export const CAMPAIGN_PLATFORMS: CampaignPlatform[] = ['instagram', 'tiktok']
export const CAMPAIGN_PLATFORM_LABELS: Record<CampaignPlatform, string> = { instagram: 'Instagram', tiktok: 'TikTok' }

export type CampaignCreatorType = 'influencer' | 'ugc'
export const CAMPAIGN_CREATOR_TYPE_LABELS: Record<CampaignCreatorType, string> = { influencer: 'Influencer', ugc: 'UGC' }

export const CAMPAIGN_LIMITS = {
  nameMax: 120,
  goalMax: 1000,
  textMax: 1500,
  exampleLinks: 10,
  linkMax: 300,
  hashtags: 20,
  hashtagMax: 60,
  categories: 20,
  cities: 20,
  deliverables: 10,
  quantityMax: 50,
  budgetMax: 100_000_000,
  followersMax: 1_000_000_000,
  plannedCreatorsMax: 1000,
  /** Tek seferde davet edilebilecek en fazla profil. */
  inviteMax: 25,
  suggestions: 30,
  perBrand: 100,
} as const

export interface CampaignDeliverable {
  kind: DeliverableKind
  quantity: number
}

/** Tablo satırı (public.campaigns). */
export interface CampaignRow {
  id: string
  brand_id: string
  name: string
  status: CampaignStatus
  goal: string | null
  key_messages: string | null
  dos: string | null
  donts: string | null
  example_links: string[]
  hashtags: string[]
  notes: string | null
  target_categories: string[]
  target_cities: string[]
  target_platforms: CampaignPlatform[]
  target_creator_type: CampaignCreatorType | null
  min_followers: number | null
  max_followers: number | null
  total_budget: number | null
  /** Kişi başı bütçe (isteğe bağlı, 3.19-S1). */
  per_creator_budget: number | null
  /** Planlanan profil sayısı (isteğe bağlı); kişi başı bütçe yoksa toplam bütçe buna bölünür. */
  planned_creators: number | null
  start_date: string | null
  end_date: string | null
  default_deliverables: CampaignDeliverable[]
  created_at: string
  updated_at: string
}

export const CAMPAIGN_COLUMNS =
  'id, brand_id, name, status, goal, key_messages, dos, donts, example_links, hashtags, notes, target_categories, target_cities, target_platforms, target_creator_type, min_followers, max_followers, total_budget, per_creator_budget, planned_creators, start_date, end_date, default_deliverables, created_at, updated_at'

/**
 * Davet edilen influencer'ın gördüğü brief (salt okunur). Hedef kitle, toplam bütçe ve diğer davetliler gibi
 * markaya özel alanlar burada yoktur.
 */
export interface CampaignBrief {
  id: string
  name: string
  goal: string | null
  key_messages: string | null
  dos: string | null
  donts: string | null
  example_links: string[]
  hashtags: string[]
  notes: string | null
  start_date: string | null
  end_date: string | null
  default_deliverables: CampaignDeliverable[]
}

export const CAMPAIGN_BRIEF_COLUMNS =
  'id, name, goal, key_messages, dos, donts, example_links, hashtags, notes, start_date, end_date, default_deliverables'

/** Form girdisi (web ve mobil aynı alanlar). Listeler dizi ya da satır satır metin olabilir. */
export interface CampaignInput {
  name?: unknown
  goal?: unknown
  keyMessages?: unknown
  dos?: unknown
  donts?: unknown
  exampleLinks?: unknown
  hashtags?: unknown
  notes?: unknown
  targetCategories?: unknown
  targetCities?: unknown
  targetPlatforms?: unknown
  targetCreatorType?: unknown
  minFollowers?: unknown
  maxFollowers?: unknown
  totalBudget?: unknown
  perCreatorBudget?: unknown
  plannedCreators?: unknown
  startDate?: unknown
  endDate?: unknown
  defaultDeliverables?: unknown
}

/** Kampanya özelliklerinin açık olup olmadığı (ücretsiz marka sınırları bayrağı açıkken Spotlight Pro'ya özel). */
export interface CampaignFeatures {
  /** Sihirbazda sunucunun önerdiği profiller. */
  suggestions: boolean
  /** Tek seferde birden fazla profile davet. */
  bulkInvite: boolean
  /** Kampanya sonuç raporu (toplamlar, maliyet, yazdırılabilir rapor, CSV ölçüm sütunları; 3.20). İş birliği başına ölçüm herkese açık. */
  results: boolean
}

export interface CampaignSuggestion {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  category: string | null
  city: string | null
  creator_type: string | null
  followers: number
  engagement: number | null
  platforms: string[]
  /** Fiyat kartındaki en düşük başlangıç fiyatı (yalnızca doğrulanmış markaya). */
  starting_price: number | null
  /** Başlangıç fiyatı profil başına düşen bütçeye sığıyor mu (campaignBudgetPerCreator; bütçe ya da fiyat yoksa null). */
  fits_budget: boolean | null
  category_match: 'primary' | 'related' | null
  availability: Availability
  already_invited: boolean
}

export type CampaignOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'
export const CAMPAIGN_OFFER_STATUS_LABELS: Record<CampaignOfferStatus, string> = {
  pending: 'Yanıt bekliyor',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
  expired: 'Süresi doldu',
  withdrawn: 'Geri çekildi',
}

export interface CampaignDashboardRow {
  key: string
  source: 'offer' | 'application'
  offer_id: string | null
  application_id: string | null
  advert_title: string | null
  creator: { id: string; full_name: string | null; username: string | null; avatar_url: string | null }
  /** Teklif durumu; başvuruda null (başvuru kabul edilmiş demektir). */
  offer_status: CampaignOfferStatus | null
  offer_budget: number | null
  collaboration_id: string | null
  collaboration_status: string | null
  deliverables_total: number
  deliverables_published: number
  agreed_fee: number | null
  payment_type: 'cash' | 'barter' | null
  agreement_confirmed: boolean
  brand_paid: boolean
  influencer_confirmed: boolean
  room_id: string | null
  created_at: string
}

export interface CampaignDashboardSummary {
  total_budget: number | null
  /** İptal edilmemiş iş birliklerinde anlaşılan nakit ücretlerin toplamı. */
  committed: number
  /** Marka "Ödeme yapıldı" işaretlediği ücretlerin toplamı. */
  marked_paid: number
  /** Influencer "Ödeme alındı" teyidi olan ücretlerin toplamı. */
  confirmed_paid: number
  invited: number
  pending: number
  accepted: number
  declined: number
  collaborations: number
  completed: number
}

export interface CampaignDashboard {
  campaign: CampaignRow
  rows: CampaignDashboardRow[]
  summary: CampaignDashboardSummary
  adverts: Array<{ id: string; title: string; status: string | null }>
}

export interface CampaignListItem extends CampaignRow {
  invited_count: number
  accepted_count: number
  advert_count: number
}

export function formatTryAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString('tr-TR')} ₺`
}

export function deliverablesText(list: CampaignDeliverable[] | null | undefined) {
  if (!list || list.length === 0) return null
  return list.map((d) => `${d.quantity} × ${DELIVERABLE_KIND_LABELS[d.kind] ?? d.kind}`).join(', ')
}

/** Brief'te gösterilecek dolu alan var mı. */
export function briefHasContent(b: Pick<CampaignBrief, 'goal' | 'key_messages' | 'dos' | 'donts' | 'example_links' | 'hashtags' | 'notes' | 'default_deliverables'>) {
  return Boolean(
    b.goal || b.key_messages || b.dos || b.donts || b.notes || b.example_links?.length || b.hashtags?.length || b.default_deliverables?.length,
  )
}

/**
 * "Bütçeye sığar" kıyası için profil başına bütçe (3.19-S1): kişi başı bütçe girildiyse o; yoksa toplam bütçe planlanan
 * profil sayısına bölünür; o da yoksa toplam bütçe. Hiçbiri yoksa null.
 */
export function campaignBudgetPerCreator(
  c: Pick<CampaignRow, 'total_budget' | 'per_creator_budget' | 'planned_creators'>,
): { amount: number; basis: 'per_creator' | 'planned' | 'total' } | null {
  if (c.per_creator_budget !== null && c.per_creator_budget !== undefined) return { amount: c.per_creator_budget, basis: 'per_creator' }
  if (c.total_budget === null || c.total_budget === undefined) return null
  if (c.planned_creators && c.planned_creators > 0) return { amount: Math.floor(c.total_budget / c.planned_creators), basis: 'planned' }
  return { amount: c.total_budget, basis: 'total' }
}

export const BUDGET_BASIS_LABELS = {
  per_creator: 'kişi başı bütçe',
  planned: 'toplam bütçe ÷ planlanan profil',
  total: 'toplam bütçe',
} as const
