// Kampanyalar (yol haritası özellik 4, 2026-10-14 kullanıcı onayı; SYSTEM_MAP 3.19).
// Kampanya markaya ait bir kapsayıcıdır: brief, hedef, bütçe, tarihler, varsayılan teslimatlar ve durum.
// Davetler mevcut teklif akışıyla gönderilir (lib/offers.ts createOfferAs): kota, doğrulama, 7 günlük süre, bildirimler,
// keşif çarkı aynen uygulanır ve her davet ücretsiz marka teklif hakkından düşer. Teklifler ve ilanlar campaign_id ile bağlanır;
// bağlı ilandan kabul edilen başvurular da kampanyanın parçası sayılır.
//
// Okumalar markanın RLS'li oturum istemcisiyle (kampanya, teklif, ilan, iş birliği satırları yalnızca sahibine / taraflara döner);
// kampanya yazımları burada, rol + onay + sahiplik kontrolünden sonra service role ile. Davet edilen influencer brief'i yalnızca
// buradaki okuyucularla görür (teklifin alıcısı / iş birliğinin tarafı olduğu önceden doğrulanmış olmalı).
//
// Kapı: ücretsiz marka sınırları bayrağı açıkken öneriler (sihirbaz) ve toplu davet (birden fazla profil) yalnızca Spotlight Pro;
// ücretsiz ve Basic marka kampanya açar ve profilleri tek tek ekler. Bayrak kapalıyken herkes her şeyi kullanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getBrandLimitContext, type BrandLimitContext } from '@/lib/brand-limits'
import { createOfferAs, validateOfferFields } from '@/lib/offers'
import { effectiveOfferStatus } from '@/lib/offer-shared'
import { getViewerInfo, listDiscoverProfiles, profileReader } from '@/lib/profile-reads'
import { visibleMinPrices } from '@/lib/rate-card'
import { canonicalCity, type DiscoverFilters } from '@/lib/discover-filters'
import { influencerCategoriesForBrand, normalizeInfluencerCategory } from '@/lib/category-map'
import { INFLUENCER_CATEGORY_KEYS } from '@/utils/categories'
import { COLLABORATION_STATUS_LABELS, type CollaborationStatus } from '@/lib/collaboration-shared'
import type { CampaignResults } from '@/lib/post-metrics-shared'
import {
  CAMPAIGN_BRIEF_COLUMNS,
  CAMPAIGN_COLUMNS,
  CAMPAIGN_CREATOR_TYPE_LABELS,
  CAMPAIGN_LIMITS,
  CAMPAIGN_OFFER_STATUS_LABELS,
  CAMPAIGN_OPEN_STATUSES,
  CAMPAIGN_PLATFORMS,
  CAMPAIGN_STATUSES,
  DELIVERABLE_KIND_LABELS,
  DELIVERABLE_KINDS,
  campaignBudgetPerCreator,
  type CampaignBrief,
  type CampaignCreatorType,
  type CampaignDashboard,
  type CampaignDashboardRow,
  type CampaignDeliverable,
  type CampaignFeatures,
  type CampaignInput,
  type CampaignListItem,
  type CampaignOfferStatus,
  type CampaignPlatform,
  type CampaignRow,
  type CampaignStatus,
  type CampaignSuggestion,
  type DeliverableKind,
} from '@/lib/campaigns-shared'

export * from '@/lib/campaigns-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Harf (Türkçe dahil), rakam, _ ve . (u bayrağı hedef sürüm yüzünden kurucuyla).
const HASHTAG_RE = new RegExp('^[#@][\\p{L}\\p{N}_.]+$', 'u')
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

export const CAMPAIGN_NOT_FOUND = 'Kampanya bulunamadı.'
export const CAMPAIGN_PRO_ONLY = 'Kampanya önerileri ve toplu davet Spotlight Pro markalara özel. Profilleri tek tek ekleyebilirsin.'

// --- Yetki ----------------------------------------------------------------------------------------

/** Kampanya özellikleri: bayrak açıkken öneriler, toplu davet ve kampanya sonuç raporu yalnızca Spotlight Pro'da. */
export async function campaignFeaturesFor(userId: string, ctx?: BrandLimitContext): Promise<CampaignFeatures> {
  const context = ctx ?? (await getBrandLimitContext(userId))
  const limited = context.active && context.plan !== 'pro'
  return { suggestions: !limited, bulkInvite: !limited, results: !limited }
}

/** Yalnızca onaylı marka kampanya kullanır. Sorun yoksa null. */
async function brandGate(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const viewer = await getViewerInfo(supabase, userId)
  if (!viewer || viewer.role !== 'brand') return 'Kampanyalar yalnızca marka hesapları içindir.'
  if (viewer.verification_status !== 'verified') return 'Kampanya oluşturmak için hesabınızın onaylanması gerekir.'
  return null
}

/** Markanın kendi kampanyası (RLS'li oturum istemcisi; başka markanınki hiç dönmez). */
export async function getCampaignAs(supabase: SupabaseClient, userId: string, campaignId: string): Promise<CampaignRow | null> {
  if (!isUuid(campaignId)) return null
  const { data, error } = await supabase.from('campaigns').select(CAMPAIGN_COLUMNS).eq('id', campaignId).eq('brand_id', userId).maybeSingle()
  if (error) {
    console.error('[campaigns] okuma hatası:', error.message)
    return null
  }
  return (data as unknown as CampaignRow | null) ?? null
}

// --- Doğrulama ------------------------------------------------------------------------------------

const cleanText = (raw: unknown, max: number): string | null | 'too_long' => {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const value = raw.replace(/\r\n/g, '\n').trim()
  if (!value) return null
  return value.length > max ? 'too_long' : value
}

/** Dizi ya da satır / virgülle ayrılmış metin → temiz liste. */
function toList(raw: unknown, separators: RegExp = /[\n,]/): string[] {
  const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(separators) : []
  return items.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
}

function parseDate(raw: unknown): string | null | 'invalid' {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'invalid'
  const d = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return 'invalid'
  return raw
}

function parseInteger(raw: unknown, max: number): number | null | 'invalid' {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[\s.₺]/g, ''))
  if (!Number.isInteger(n) || n < 0 || n > max) return 'invalid'
  return n
}

function validateLink(value: string): string | null {
  if (value.length > CAMPAIGN_LIMITS.linkMax) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password || !url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

type CampaignFields = Omit<CampaignRow, 'id' | 'brand_id' | 'status' | 'created_at' | 'updated_at'>

export function validateCampaignInput(input: CampaignInput): { value: CampaignFields } | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'Kampanya bilgileri eksik.' }

  const name = cleanText(input.name, CAMPAIGN_LIMITS.nameMax)
  if (!name || name === 'too_long') return { error: `Kampanya adı 1-${CAMPAIGN_LIMITS.nameMax} karakter olmalı.` }

  const texts: Record<'goal' | 'key_messages' | 'dos' | 'donts' | 'notes', string | null> = {
    goal: null,
    key_messages: null,
    dos: null,
    donts: null,
    notes: null,
  }
  const textFields: Array<[keyof typeof texts, unknown, number, string]> = [
    ['goal', input.goal, CAMPAIGN_LIMITS.goalMax, 'Hedef'],
    ['key_messages', input.keyMessages, CAMPAIGN_LIMITS.textMax, 'Ana mesajlar'],
    ['dos', input.dos, CAMPAIGN_LIMITS.textMax, 'Yapılacaklar'],
    ['donts', input.donts, CAMPAIGN_LIMITS.textMax, 'Yapılmayacaklar'],
    ['notes', input.notes, CAMPAIGN_LIMITS.textMax, 'Notlar'],
  ]
  for (const [key, raw, max, label] of textFields) {
    const value = cleanText(raw, max)
    if (value === 'too_long') return { error: `${label} en fazla ${max} karakter olabilir.` }
    texts[key] = value
  }

  const rawLinks = toList(input.exampleLinks, /[\n\s,]+/)
  if (rawLinks.length > CAMPAIGN_LIMITS.exampleLinks) return { error: `En fazla ${CAMPAIGN_LIMITS.exampleLinks} örnek link eklenebilir.` }
  const exampleLinks: string[] = []
  for (const raw of rawLinks) {
    const link = validateLink(raw)
    if (!link) return { error: `Örnek link geçersiz: ${raw.slice(0, 60)} (http:// veya https:// ile başlamalı).` }
    if (!exampleLinks.includes(link)) exampleLinks.push(link)
  }

  const rawTags = toList(input.hashtags, /[\n\s,]+/)
  if (rawTags.length > CAMPAIGN_LIMITS.hashtags) return { error: `En fazla ${CAMPAIGN_LIMITS.hashtags} etiket / bahsetme eklenebilir.` }
  const hashtags: string[] = []
  for (const raw of rawTags) {
    const tag = raw.startsWith('#') || raw.startsWith('@') ? raw : `#${raw}`
    if (tag.length < 2 || tag.length > CAMPAIGN_LIMITS.hashtagMax || !HASHTAG_RE.test(tag)) {
      return { error: `Etiket geçersiz: ${raw.slice(0, 40)} (yalnızca harf, rakam, _ ve .).` }
    }
    if (!hashtags.includes(tag)) hashtags.push(tag)
  }

  const categories = Array.from(new Set(toList(input.targetCategories)))
  if (categories.length > CAMPAIGN_LIMITS.categories) return { error: 'Çok fazla kategori seçildi.' }
  if (categories.some((c) => !(INFLUENCER_CATEGORY_KEYS as string[]).includes(c))) return { error: 'Kategori listesi geçersiz.' }

  const cityList = toList(input.targetCities)
  if (cityList.length > CAMPAIGN_LIMITS.cities) return { error: `En fazla ${CAMPAIGN_LIMITS.cities} şehir seçilebilir.` }
  const cities: string[] = []
  for (const raw of cityList) {
    const city = canonicalCity(raw)
    if (!city) return { error: `Şehir bulunamadı: ${raw.slice(0, 40)}` }
    if (!cities.includes(city)) cities.push(city)
  }

  const platforms = Array.from(new Set(toList(input.targetPlatforms)))
  if (platforms.some((p) => !(CAMPAIGN_PLATFORMS as string[]).includes(p))) return { error: 'Platform listesi geçersiz.' }

  const creatorType =
    input.targetCreatorType === 'influencer' || input.targetCreatorType === 'ugc' ? (input.targetCreatorType as CampaignCreatorType) : null
  if (input.targetCreatorType && !creatorType && input.targetCreatorType !== 'all') return { error: 'Üretici türü geçersiz.' }

  const minFollowers = parseInteger(input.minFollowers, CAMPAIGN_LIMITS.followersMax)
  const maxFollowers = parseInteger(input.maxFollowers, CAMPAIGN_LIMITS.followersMax)
  if (minFollowers === 'invalid' || maxFollowers === 'invalid') return { error: 'Takipçi aralığı geçersiz.' }
  if (minFollowers !== null && maxFollowers !== null && maxFollowers < minFollowers) {
    return { error: 'En çok takipçi, en az takipçiden küçük olamaz.' }
  }

  const totalBudget = parseInteger(input.totalBudget, CAMPAIGN_LIMITS.budgetMax)
  if (totalBudget === 'invalid') return { error: 'Toplam bütçe 0 ile 100.000.000 ₺ arasında tam sayı olmalı.' }
  const perCreatorBudget = parseInteger(input.perCreatorBudget, CAMPAIGN_LIMITS.budgetMax)
  if (perCreatorBudget === 'invalid') return { error: 'Kişi başı bütçe 0 ile 100.000.000 ₺ arasında tam sayı olmalı.' }
  if (perCreatorBudget !== null && totalBudget !== null && perCreatorBudget > totalBudget) {
    return { error: 'Kişi başı bütçe toplam bütçeden büyük olamaz.' }
  }
  const plannedCreators = parseInteger(input.plannedCreators, CAMPAIGN_LIMITS.plannedCreatorsMax)
  if (plannedCreators === 'invalid' || plannedCreators === 0) {
    return { error: `Planlanan profil sayısı 1 ile ${CAMPAIGN_LIMITS.plannedCreatorsMax} arasında olmalı.` }
  }

  const startDate = parseDate(input.startDate)
  const endDate = parseDate(input.endDate)
  if (startDate === 'invalid' || endDate === 'invalid') return { error: 'Tarih geçersiz.' }
  if (startDate && endDate && endDate < startDate) return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' }

  const rawDeliverables = Array.isArray(input.defaultDeliverables) ? input.defaultDeliverables : []
  if (rawDeliverables.length > CAMPAIGN_LIMITS.deliverables) return { error: `En fazla ${CAMPAIGN_LIMITS.deliverables} teslimat satırı eklenebilir.` }
  const deliverables: CampaignDeliverable[] = []
  for (const item of rawDeliverables) {
    if (!item || typeof item !== 'object') return { error: 'Teslimat bilgisi geçersiz.' }
    const kind = (item as { kind?: unknown }).kind as DeliverableKind
    const quantity = Number((item as { quantity?: unknown }).quantity)
    if (!DELIVERABLE_KINDS.includes(kind)) return { error: 'Teslimat türünü seçin.' }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > CAMPAIGN_LIMITS.quantityMax) {
      return { error: `Teslimat adedi 1 ile ${CAMPAIGN_LIMITS.quantityMax} arasında olmalı.` }
    }
    deliverables.push({ kind, quantity })
  }

  return {
    value: {
      name,
      ...texts,
      example_links: exampleLinks,
      hashtags,
      target_categories: categories,
      target_cities: cities,
      target_platforms: platforms as CampaignPlatform[],
      target_creator_type: creatorType,
      min_followers: minFollowers,
      max_followers: maxFollowers,
      total_budget: totalBudget,
      per_creator_budget: perCreatorBudget,
      planned_creators: plannedCreators,
      start_date: startDate,
      end_date: endDate,
      default_deliverables: deliverables,
    },
  }
}

/** DB'den gelen varsayılan teslimat listesini güvenli biçime çevirir. */
function normalizeDeliverables(raw: unknown): CampaignDeliverable[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((d): d is CampaignDeliverable => !!d && DELIVERABLE_KINDS.includes((d as CampaignDeliverable).kind))
    .map((d) => ({ kind: d.kind, quantity: Math.min(Math.max(1, Math.floor(Number(d.quantity) || 1)), CAMPAIGN_LIMITS.quantityMax) }))
}

// --- Liste / yazım -------------------------------------------------------------------------------

export async function listCampaignsAs(supabase: SupabaseClient, userId: string): Promise<Result<{ campaigns: CampaignListItem[] }>> {
  const gate = await brandGate(supabase, userId)
  if (gate) return { error: gate }
  const { data, error } = await supabase
    .from('campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('brand_id', userId)
    .order('created_at', { ascending: false })
    .limit(CAMPAIGN_LIMITS.perBrand)
  if (error) {
    console.error('[campaigns] liste hatası:', error.message)
    return { error: 'Kampanyalar yüklenemedi.' }
  }
  const rows = (data ?? []) as unknown as CampaignRow[]
  const ids = rows.map((r) => r.id)
  const [offersRes, advertsRes] = ids.length
    ? await Promise.all([
        supabase.from('offers').select('campaign_id, status, created_at').in('campaign_id', ids).eq('sender_user_id', userId),
        supabase.from('advert_projects').select('campaign_id').in('campaign_id', ids).eq('brand_user_id', userId),
      ])
    : [{ data: [] }, { data: [] }]
  const counts = new Map<string, { invited: number; accepted: number; adverts: number }>()
  const bump = (id: string) => {
    const c = counts.get(id) ?? { invited: 0, accepted: 0, adverts: 0 }
    counts.set(id, c)
    return c
  }
  ;((offersRes.data ?? []) as Array<{ campaign_id: string; status: string }>).forEach((o) => {
    const c = bump(o.campaign_id)
    c.invited++
    if (o.status === 'accepted') c.accepted++
  })
  ;((advertsRes.data ?? []) as Array<{ campaign_id: string }>).forEach((a) => bump(a.campaign_id).adverts++)
  return {
    success: true,
    campaigns: rows.map((row) => {
      const c = counts.get(row.id) ?? { invited: 0, accepted: 0, adverts: 0 }
      return {
        ...row,
        default_deliverables: normalizeDeliverables(row.default_deliverables),
        invited_count: c.invited,
        accepted_count: c.accepted,
        advert_count: c.adverts,
      }
    }),
  }
}

/** Davet ve bağlama yapılabilecek kampanyalar (taslak / aktif); teklif penceresindeki seçim kutusu için. */
export async function listOpenCampaignOptionsAs(supabase: SupabaseClient, userId: string): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('brand_id', userId)
    .in('status', CAMPAIGN_OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(CAMPAIGN_LIMITS.perBrand)
  return ((data ?? []) as Array<{ id: string; name: string }>).map((c) => ({ id: c.id, name: c.name }))
}

/** Kampanya oluşturur (campaignId yoksa) ya da günceller. */
export async function saveCampaignAs(
  supabase: SupabaseClient,
  userId: string,
  input: CampaignInput,
  campaignId?: string | null,
): Promise<Result<{ campaign: CampaignRow }>> {
  const gate = await brandGate(supabase, userId)
  if (gate) return { error: gate }
  const checked = validateCampaignInput(input)
  if ('error' in checked) return checked
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  const now = new Date().toISOString()

  if (campaignId) {
    const existing = await getCampaignAs(supabase, userId, campaignId)
    if (!existing) return { error: CAMPAIGN_NOT_FOUND }
    if (existing.status === 'archived') return { error: 'Arşivdeki kampanya düzenlenemez; önce arşivden çıkarın.' }
    const { data, error } = await admin
      .from('campaigns')
      .update({ ...checked.value, updated_at: now })
      .eq('id', existing.id)
      .eq('brand_id', userId)
      .select(CAMPAIGN_COLUMNS)
      .single()
    if (error || !data) {
      console.error('[campaigns] güncelleme hatası:', error?.message)
      return { error: 'Kampanya kaydedilemedi. Lütfen tekrar deneyin.' }
    }
    return { success: true, campaign: data as unknown as CampaignRow }
  }

  const { count } = await supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('brand_id', userId)
  if ((count ?? 0) >= CAMPAIGN_LIMITS.perBrand) {
    return { error: `En fazla ${CAMPAIGN_LIMITS.perBrand} kampanya oluşturabilirsiniz. Eski kampanyaları arşivleyebilirsiniz.` }
  }
  const { data, error } = await admin
    .from('campaigns')
    .insert({ ...checked.value, brand_id: userId, status: 'draft' })
    .select(CAMPAIGN_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[campaigns] ekleme hatası:', error?.message)
    return { error: 'Kampanya oluşturulamadı. Lütfen tekrar deneyin.' }
  }
  return { success: true, campaign: data as unknown as CampaignRow }
}

export async function setCampaignStatusAs(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
  status: unknown,
): Promise<Result<{ status: CampaignStatus }>> {
  const gate = await brandGate(supabase, userId)
  if (gate) return { error: gate }
  if (!CAMPAIGN_STATUSES.includes(status as CampaignStatus)) return { error: 'Geçersiz durum.' }
  const existing = await getCampaignAs(supabase, userId, campaignId)
  if (!existing) return { error: CAMPAIGN_NOT_FOUND }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  const { error } = await admin
    .from('campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .eq('brand_id', userId)
  if (error) {
    console.error('[campaigns] durum hatası:', error.message)
    return { error: 'Durum değiştirilemedi.' }
  }
  return { success: true, status: status as CampaignStatus }
}

// --- Öneriler (sihirbaz) -------------------------------------------------------------------------

/**
 * Kampanya hedefine uyan profiller. Liste lib/profile-reads.ts listDiscoverProfiles ile alınır: onay, keşif çarkı ve
 * doğrulanmış hesap kuralı aynen uygulanır (öneriler hiçbir zaman keşifte görülemeyecek profili göstermez).
 * Sıra: müsait olanlar önce, kategori uyumu, fiyat kartı profil başına bütçeye sığanlar, takipçi.
 */
export async function suggestCampaignProfilesAs(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
): Promise<Result<{ suggestions: CampaignSuggestion[] }>> {
  const gate = await brandGate(supabase, userId)
  if (gate) return { error: gate }
  const campaign = await getCampaignAs(supabase, userId, campaignId)
  if (!campaign) return { error: CAMPAIGN_NOT_FOUND }
  const features = await campaignFeaturesFor(userId)
  if (!features.suggestions) return { error: CAMPAIGN_PRO_ONLY }

  const filters: DiscoverFilters = {
    platform: campaign.target_platforms.length === 1 ? campaign.target_platforms[0] : null,
    creatorType: campaign.target_creator_type,
    city: campaign.target_cities.length === 1 ? campaign.target_cities[0] : null,
    minFollowers: campaign.min_followers,
    maxFollowers: campaign.max_followers,
  }
  const listed = await listDiscoverProfiles(supabase, userId, { filters })
  if ('error' in listed) return { error: listed.error }
  if (listed.locked) return { error: 'Hesabınız onaylanınca öneriler açılır.' }

  const viewer = await getViewerInfo(supabase, userId)
  const brandTargets = influencerCategoriesForBrand(viewer?.category)
  const targets = campaign.target_categories.length ? campaign.target_categories : brandTargets
  const cities = new Set(campaign.target_cities)

  const candidates = listed.profiles.filter((p) => {
    if (cities.size > 1 && !(p.city && cities.has(canonicalCity(p.city) ?? ''))) return false
    if (campaign.target_categories.length) {
      const key = normalizeInfluencerCategory(p.category)
      if (!key || !campaign.target_categories.includes(key)) return false
    }
    return true
  })

  const ids = candidates.map((p) => p.id)
  const [prices, invited] = await Promise.all([visibleMinPrices(supabase, ids), invitedCreatorIds(supabase, userId, campaign.id)])
  const platformFilter = campaign.target_platforms.length ? new Set<string>(campaign.target_platforms) : null
  // Başlangıç fiyatı profil başına düşen bütçeyle kıyaslanır (3.19-S1).
  const budgetPerCreator = campaignBudgetPerCreator(campaign)

  const suggestions: CampaignSuggestion[] = candidates.map((p) => {
    const accounts = platformFilter ? p.social_accounts.filter((a) => platformFilter.has(a.platform)) : p.social_accounts
    const best = [...accounts].sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))[0]
    const key = normalizeInfluencerCategory(p.category)
    const categoryMatch = !key || targets.length === 0 ? null : targets[0] === key ? 'primary' : targets.includes(key) ? 'related' : null
    const price = prices[p.id] ?? null
    return {
      id: p.id,
      full_name: p.full_name,
      username: p.username,
      avatar_url: p.avatar_url,
      category: p.category,
      city: p.city,
      creator_type: p.creator_type,
      followers: best?.follower_count ?? 0,
      engagement: best?.engagement_rate === null || best?.engagement_rate === undefined ? null : Number(best.engagement_rate),
      platforms: Array.from(new Set(p.social_accounts.map((a) => a.platform))),
      starting_price: price,
      fits_budget: price === null || budgetPerCreator === null ? null : price <= budgetPerCreator.amount,
      category_match: campaign.target_categories.length ? 'primary' : categoryMatch,
      availability: p.availability,
      already_invited: invited.has(p.id),
    }
  })

  const rank = (s: CampaignSuggestion) =>
    (s.already_invited ? 1000 : 0) +
    (s.availability.status === 'busy' ? 100 : 0) +
    (s.category_match === 'primary' ? 0 : s.category_match === 'related' ? 10 : 20) +
    (s.fits_budget === true ? 0 : s.fits_budget === null ? 1 : 2)
  suggestions.sort((a, b) => rank(a) - rank(b) || b.followers - a.followers)
  return { success: true, suggestions: suggestions.slice(0, CAMPAIGN_LIMITS.suggestions) }
}

/** Bu kampanyada bekleyen (süresi dolmamış) ya da kabul edilmiş teklifi olan profiller. */
async function invitedCreatorIds(supabase: SupabaseClient, userId: string, campaignId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('offers')
    .select('receiver_user_id, status, created_at')
    .eq('campaign_id', campaignId)
    .eq('sender_user_id', userId)
  const ids = new Set<string>()
  ;((data ?? []) as Array<{ receiver_user_id: string; status: string; created_at: string }>).forEach((o) => {
    const status = effectiveOfferStatus(o)
    if (status === 'pending' || status === 'accepted') ids.add(o.receiver_user_id)
  })
  return ids
}

// --- Davet ---------------------------------------------------------------------------------------

export interface InviteInput {
  creatorIds?: unknown
  campaignType?: unknown
  budget?: unknown
  paymentType?: unknown
  message?: unknown
}

export interface InviteOutcome {
  sent: string[]
  skipped: Array<{ id: string; reason: string }>
  failed: Array<{ id: string; error: string }>
  /** Teklif hakkı dolduğu için gönderilmeyenler (sırayla durduruldu). */
  notAttempted: string[]
  quotaError: string | null
}

/**
 * Seçilen profillere davet = her birine ayrı teklif (createOfferAs; kota, doğrulama, süre, bildirim, çark aynen uygulanır,
 * her davet teklif hakkından düşer). Teklif hakkı dolunca durur ve kalanları bildirir. Birden fazla profil aynı anda
 * yalnızca bulkInvite açıksa (bayrak kapalı ya da Spotlight Pro).
 */
export async function inviteCreatorsAs(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
  input: InviteInput,
): Promise<Result<{ outcome: InviteOutcome }>> {
  const gate = await brandGate(supabase, userId)
  if (gate) return { error: gate }
  if (!input || typeof input !== 'object') return { error: 'Geçersiz istek.' }
  const campaign = await getCampaignAs(supabase, userId, campaignId)
  if (!campaign) return { error: CAMPAIGN_NOT_FOUND }
  if (!CAMPAIGN_OPEN_STATUSES.includes(campaign.status)) return { error: 'Tamamlanan ya da arşivlenen kampanyaya davet gönderilemez.' }

  const raw = Array.isArray(input.creatorIds) ? input.creatorIds : []
  const ids = Array.from(new Set(raw.filter(isUuid)))
  if (ids.length === 0) return { error: 'Davet edilecek profil seçin.' }
  if (ids.length !== raw.length) return { error: 'Profil listesi geçersiz.' }
  if (ids.length > CAMPAIGN_LIMITS.inviteMax) return { error: `Tek seferde en fazla ${CAMPAIGN_LIMITS.inviteMax} profile davet gönderilebilir.` }
  if (ids.length > 1 && !(await campaignFeaturesFor(userId)).bulkInvite) return { error: CAMPAIGN_PRO_ONLY }

  // Teklif alanları herkes için aynı: önce bir kez doğrulanır (hatalıysa hiçbir davet gönderilmez).
  const offerFields = {
    campaignName: campaign.name,
    campaignType: typeof input.campaignType === 'string' ? input.campaignType : null,
    budget: typeof input.budget === 'number' || typeof input.budget === 'string' ? input.budget : null,
    paymentType: input.paymentType === 'barter' ? ('barter' as const) : ('cash' as const),
    message: typeof input.message === 'string' ? input.message : null,
  }
  const fieldCheck = validateOfferFields(offerFields)
  if ('error' in fieldCheck) return { error: fieldCheck.error }

  const already = await invitedCreatorIds(supabase, userId, campaign.id)
  const outcome: InviteOutcome = { sent: [], skipped: [], failed: [], notAttempted: [], quotaError: null }
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (already.has(id)) {
      outcome.skipped.push({ id, reason: 'Bu kampanyada zaten bekleyen ya da kabul edilmiş teklifi var.' })
      continue
    }
    const result = await createOfferAs(supabase, userId, { ...offerFields, receiverId: id, campaignId: campaign.id })
    if ('error' in result) {
      if (result.code === 'quota') {
        outcome.quotaError = result.error
        outcome.failed.push({ id, error: result.error })
        outcome.notAttempted = ids.slice(i + 1).filter((rest) => !already.has(rest))
        break
      }
      outcome.failed.push({ id, error: result.error })
      continue
    }
    outcome.sent.push(id)
  }

  if (outcome.sent.length > 0 && campaign.status === 'draft') {
    const admin = createSupabaseAdminClient()
    await admin
      ?.from('campaigns')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('brand_id', userId)
      .eq('status', 'draft')
  }
  return { success: true, outcome }
}

// --- Bağlama (mevcut teklif / ilan) ---------------------------------------------------------------

export async function listAttachablesAs(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ offers: Array<{ id: string; campaign_name: string | null; status: string; created_at: string; receiver_name: string | null }>; adverts: Array<{ id: string; title: string; status: string | null }> }> {
  const [offersRes, advertsRes] = await Promise.all([
    supabase
      .from('offers')
      .select('id, campaign_name, status, created_at, receiver_user_id')
      .eq('sender_user_id', userId)
      .is('campaign_id', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('advert_projects')
      .select('id, title, status')
      .eq('brand_user_id', userId)
      .is('campaign_id', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  const offers = (offersRes.data ?? []) as Array<{ id: string; campaign_name: string | null; status: string; created_at: string; receiver_user_id: string }>
  const names = await creatorCards(offers.map((o) => o.receiver_user_id))
  return {
    offers: offers.map((o) => ({
      id: o.id,
      campaign_name: o.campaign_name,
      status: effectiveOfferStatus(o),
      created_at: o.created_at,
      receiver_name: names.get(o.receiver_user_id)?.full_name ?? names.get(o.receiver_user_id)?.username ?? null,
    })),
    adverts: (advertsRes.data ?? []) as Array<{ id: string; title: string; status: string | null }>,
  }
}

/** Teklif ya da ilanı kampanyaya bağlar / bağı kaldırır. Yalnızca markanın kendi kaydı ve kendi kampanyası. */
export async function linkToCampaignAs(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
  input: { kind?: unknown; id?: unknown; attach?: unknown },
): Promise<Result> {
  const gate = await brandGate(supabase, userId)
  if (gate) return { error: gate }
  if (!input || (input.kind !== 'offer' && input.kind !== 'advert') || !isUuid(input.id)) return { error: 'Geçersiz istek.' }
  const campaign = await getCampaignAs(supabase, userId, campaignId)
  if (!campaign) return { error: CAMPAIGN_NOT_FOUND }
  const attach = input.attach !== false
  if (attach && !CAMPAIGN_OPEN_STATUSES.includes(campaign.status)) return { error: 'Tamamlanan ya da arşivlenen kampanyaya ekleme yapılamaz.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }

  const table = input.kind === 'offer' ? 'offers' : 'advert_projects'
  const owner = input.kind === 'offer' ? 'sender_user_id' : 'brand_user_id'
  // Sahiplik oturum istemcisiyle (RLS) ve açık sahip kolonuyla doğrulanır.
  const { data: row } = await supabase.from(table).select(`id, campaign_id, ${owner}`).eq('id', input.id).eq(owner, userId).maybeSingle()
  if (!row) return { error: input.kind === 'offer' ? 'Teklif bulunamadı.' : 'İlan bulunamadı.' }
  const current = (row as unknown as { campaign_id: string | null }).campaign_id
  if (attach && current && current !== campaign.id) return { error: 'Bu kayıt başka bir kampanyaya bağlı; önce oradan çıkarın.' }
  if (!attach && current !== campaign.id) return { error: 'Bu kayıt bu kampanyaya bağlı değil.' }

  const { error } = await admin
    .from(table)
    .update({ campaign_id: attach ? campaign.id : null })
    .eq('id', input.id)
    .eq(owner, userId)
  if (error) {
    console.error('[campaigns] bağlama hatası:', error.message)
    return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  return { success: true }
}

// --- Pano ----------------------------------------------------------------------------------------

type CreatorCard = { id: string; full_name: string | null; username: string | null; avatar_url: string | null }

/** Kampanya satırlarındaki profillerin kartları (yalnızca markanın kendi teklif / başvuru kayıtlarından gelen kimlikler). */
async function creatorCards(ids: string[]): Promise<Map<string, CreatorCard>> {
  const out = new Map<string, CreatorCard>()
  const unique = Array.from(new Set(ids.filter(isUuid)))
  const reader = profileReader()
  if (!reader || unique.length === 0) return out
  for (let i = 0; i < unique.length; i += 100) {
    const { data } = await reader.from('users').select('id, full_name, username, avatar_url').in('id', unique.slice(i, i + 100))
    ;((data ?? []) as CreatorCard[]).forEach((c) => out.set(c.id, c))
  }
  return out
}

/** Kampanya panosu: tüm profiller, teklif / iş birliği durumu, teslimat ilerlemesi, ücret, ödeme ve bütçe özeti. */
export async function getCampaignDashboardAs(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
): Promise<Result<{ dashboard: CampaignDashboard }>> {
  const gate = await brandGate(supabase, userId)
  if (gate) return { error: gate }
  const campaign = await getCampaignAs(supabase, userId, campaignId)
  if (!campaign) return { error: CAMPAIGN_NOT_FOUND }

  const [offersRes, advertsRes] = await Promise.all([
    supabase
      .from('offers')
      .select('id, receiver_user_id, status, created_at, budget, payment_type')
      .eq('campaign_id', campaign.id)
      .eq('sender_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('advert_projects').select('id, title, status').eq('campaign_id', campaign.id).eq('brand_user_id', userId).limit(50),
  ])
  if (offersRes.error || advertsRes.error) {
    console.error('[campaigns] pano okuma hatası:', offersRes.error?.message ?? advertsRes.error?.message)
    return { error: 'Kampanya yüklenemedi.' }
  }
  const offers = (offersRes.data ?? []) as Array<{ id: string; receiver_user_id: string; status: string; created_at: string; budget: number | string | null; payment_type: string | null }>
  const adverts = (advertsRes.data ?? []) as Array<{ id: string; title: string; status: string | null }>
  const advertTitle = new Map(adverts.map((a) => [a.id, a.title]))

  const appsRes = adverts.length
    ? await supabase
        .from('advert_applications')
        .select('id, advert_id, influencer_user_id, status, created_at')
        .in(
          'advert_id',
          adverts.map((a) => a.id),
        )
        .eq('status', 'accepted')
        .limit(500)
    : { data: [] }
  const applications = (appsRes.data ?? []) as Array<{ id: string; advert_id: string; influencer_user_id: string; status: string; created_at: string }>

  const offerIds = offers.map((o) => o.id)
  const appIds = applications.map((a) => a.id)
  const collabCols = 'id, offer_id, application_id, status, room_id'
  const [collabByOffer, collabByApp] = await Promise.all([
    offerIds.length ? supabase.from('collaborations').select(collabCols).eq('brand_id', userId).in('offer_id', offerIds) : Promise.resolve({ data: [] }),
    appIds.length ? supabase.from('collaborations').select(collabCols).eq('brand_id', userId).in('application_id', appIds) : Promise.resolve({ data: [] }),
  ])
  type CollabLite = { id: string; offer_id: string | null; application_id: string | null; status: CollaborationStatus; room_id: string | null }
  const collabs = [...((collabByOffer.data ?? []) as CollabLite[]), ...((collabByApp.data ?? []) as CollabLite[])]
  const collabIds = collabs.map((c) => c.id)
  const empty = Promise.resolve({ data: [] as unknown[] })
  const [delivRes, agreeRes, payRes, roomRes] = await Promise.all([
    collabIds.length ? supabase.from('collaboration_deliverables').select('collaboration_id, status').in('collaboration_id', collabIds) : empty,
    collabIds.length
      ? supabase
          .from('collaboration_agreements')
          .select('collaboration_id, fee_amount, payment_type, brand_confirmed_at, influencer_confirmed_at')
          .in('collaboration_id', collabIds)
      : empty,
    collabIds.length
      ? supabase.from('collaboration_payments').select('collaboration_id, brand_paid_at, influencer_received_at').in('collaboration_id', collabIds)
      : empty,
    offerIds.length ? supabase.from('rooms').select('id, offer_id').in('offer_id', offerIds) : empty,
  ])

  const progress = new Map<string, { total: number; published: number }>()
  ;((delivRes.data ?? []) as Array<{ collaboration_id: string; status: string }>).forEach((d) => {
    const p = progress.get(d.collaboration_id) ?? { total: 0, published: 0 }
    p.total++
    if (d.status === 'published') p.published++
    progress.set(d.collaboration_id, p)
  })
  const agreements = new Map(
    ((agreeRes.data ?? []) as Array<{ collaboration_id: string; fee_amount: number | null; payment_type: 'cash' | 'barter'; brand_confirmed_at: string | null; influencer_confirmed_at: string | null }>).map(
      (a) => [a.collaboration_id, a],
    ),
  )
  const payments = new Map(
    ((payRes.data ?? []) as Array<{ collaboration_id: string; brand_paid_at: string | null; influencer_received_at: string | null }>).map((p) => [p.collaboration_id, p]),
  )
  const roomByOffer = new Map(((roomRes.data ?? []) as Array<{ id: string; offer_id: string | null }>).filter((r) => r.offer_id).map((r) => [r.offer_id as string, r.id]))
  const collabByOfferId = new Map(collabs.filter((c) => c.offer_id).map((c) => [c.offer_id as string, c]))
  const collabByAppId = new Map(collabs.filter((c) => c.application_id).map((c) => [c.application_id as string, c]))
  const cards = await creatorCards([...offers.map((o) => o.receiver_user_id), ...applications.map((a) => a.influencer_user_id)])

  const buildCollabPart = (collab: CollabLite | undefined) => {
    if (!collab) {
      return {
        collaboration_id: null,
        collaboration_status: null,
        deliverables_total: 0,
        deliverables_published: 0,
        agreed_fee: null,
        payment_type: null,
        agreement_confirmed: false,
        brand_paid: false,
        influencer_confirmed: false,
      }
    }
    const p = progress.get(collab.id) ?? { total: 0, published: 0 }
    const a = agreements.get(collab.id)
    const pay = payments.get(collab.id)
    return {
      collaboration_id: collab.id,
      collaboration_status: collab.status,
      deliverables_total: p.total,
      deliverables_published: p.published,
      agreed_fee: a?.fee_amount ?? null,
      payment_type: a?.payment_type ?? null,
      agreement_confirmed: !!a?.brand_confirmed_at && !!a?.influencer_confirmed_at,
      brand_paid: !!pay?.brand_paid_at,
      influencer_confirmed: !!pay?.influencer_received_at,
    }
  }
  const cardOf = (id: string): CreatorCard => cards.get(id) ?? { id, full_name: null, username: null, avatar_url: null }

  const rows: CampaignDashboardRow[] = [
    ...offers.map((o): CampaignDashboardRow => {
      const collab = collabByOfferId.get(o.id)
      return {
        key: `offer:${o.id}`,
        source: 'offer',
        offer_id: o.id,
        application_id: null,
        advert_title: null,
        creator: cardOf(o.receiver_user_id),
        offer_status: effectiveOfferStatus(o) as CampaignOfferStatus,
        offer_budget: o.budget === null || o.budget === undefined ? null : Number(o.budget),
        ...buildCollabPart(collab),
        room_id: collab?.room_id ?? roomByOffer.get(o.id) ?? null,
        created_at: o.created_at,
      }
    }),
    ...applications.map((a): CampaignDashboardRow => {
      const collab = collabByAppId.get(a.id)
      return {
        key: `application:${a.id}`,
        source: 'application',
        offer_id: null,
        application_id: a.id,
        advert_title: advertTitle.get(a.advert_id) ?? null,
        creator: cardOf(a.influencer_user_id),
        offer_status: null,
        offer_budget: null,
        ...buildCollabPart(collab),
        room_id: collab?.room_id ?? null,
        created_at: a.created_at,
      }
    }),
  ]

  const live = rows.filter((r) => r.collaboration_id && r.collaboration_status !== 'cancelled')
  const cashFee = (r: CampaignDashboardRow) => (r.payment_type === 'barter' ? 0 : r.agreed_fee ?? 0)
  const summary = {
    total_budget: campaign.total_budget,
    committed: live.reduce((sum, r) => sum + cashFee(r), 0),
    marked_paid: live.filter((r) => r.brand_paid).reduce((sum, r) => sum + cashFee(r), 0),
    confirmed_paid: live.filter((r) => r.influencer_confirmed).reduce((sum, r) => sum + cashFee(r), 0),
    invited: offers.length,
    pending: rows.filter((r) => r.offer_status === 'pending').length,
    accepted: rows.filter((r) => r.offer_status === 'accepted' || r.source === 'application').length,
    declined: rows.filter((r) => r.offer_status === 'rejected' || r.offer_status === 'expired' || r.offer_status === 'withdrawn').length,
    collaborations: live.length,
    completed: live.filter((r) => r.collaboration_status === 'completed').length,
  }

  return {
    success: true,
    dashboard: { campaign: { ...campaign, default_deliverables: normalizeDeliverables(campaign.default_deliverables) }, rows, summary, adverts },
  }
}

/**
 * Panodaki tablo CSV olarak (Excel için ; ayraçlı, UTF-8 BOM). Formül olarak yorumlanabilecek hücreler kaçırılır.
 * results verilirse (sonuç raporu açık, 3.20) ölçüm ve maliyet sütunları eklenir.
 */
export function campaignDashboardCsv(dashboard: CampaignDashboard, results?: CampaignResults | null): string {
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  const header = [
    'Profil',
    'Kullanıcı adı',
    'Kaynak',
    'Teklif durumu',
    'Teklif bütçesi (₺)',
    'İş birliği durumu',
    'Yayınlanan teslimat',
    'Toplam teslimat',
    'Anlaşılan ücret (₺)',
    'Ödeme türü',
    'Marka ödeme yaptı',
    'Influencer ödemeyi aldı',
    'Tarih',
    ...(results
      ? ['Ölçülen gönderi', 'İzlenme', 'Beğeni', 'Yorum', 'Etkileşim (%)', 'Etkileşim ölçütü', '1000 izlenme başı maliyet (₺)', 'Etkileşim başı maliyet (₺)', 'Son ölçüm']
      : []),
  ]
  const resultByKey = new Map((results?.rows ?? []).map((r) => [r.key, r]))
  const decimal = (value: number | null | undefined) => (value === null || value === undefined ? '' : value.toFixed(2).replace('.', ','))
  const lines = dashboard.rows.map((r) =>
    [
      r.creator.full_name ?? '',
      r.creator.username ? `@${r.creator.username}` : '',
      r.source === 'offer' ? 'Teklif' : `İlan: ${r.advert_title ?? ''}`,
      r.offer_status ? CAMPAIGN_OFFER_STATUS_LABELS[r.offer_status] : 'Başvuru kabul edildi',
      r.offer_budget ?? '',
      r.collaboration_status ? COLLABORATION_STATUS_LABELS[r.collaboration_status as CollaborationStatus] ?? r.collaboration_status : '',
      r.collaboration_id ? r.deliverables_published : '',
      r.collaboration_id ? r.deliverables_total : '',
      r.agreed_fee ?? '',
      r.payment_type === 'barter' ? 'Barter' : r.payment_type === 'cash' ? 'Nakit' : '',
      r.collaboration_id ? (r.brand_paid ? 'Evet' : 'Hayır') : '',
      r.collaboration_id ? (r.influencer_confirmed ? 'Evet' : 'Hayır') : '',
      r.created_at.slice(0, 10),
      ...(results
        ? (() => {
            const m = resultByKey.get(r.key)
            if (!m) return ['', '', '', '', '', '', '', '', '']
            return [
              m.posts_measured,
              m.views ?? '',
              m.likes,
              m.comments,
              decimal(m.engagement?.value),
              m.engagement ? (m.engagement.basis === 'views' ? 'İzlenmeye göre' : 'Takipçiye göre') : '',
              decimal(m.cost_per_1000_views),
              decimal(m.cost_per_engagement),
              m.last_captured_at ? m.last_captured_at.slice(0, 10) : '',
            ]
          })()
        : []),
    ]
      .map(cell)
      .join(';'),
  )
  return `﻿${[header.map(cell).join(';'), ...lines].join('\r\n')}\r\n`
}

export function campaignCsvFilename(campaign: Pick<CampaignRow, 'name' | 'id'>) {
  const slug = campaign.name
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `kampanya-${slug || campaign.id.slice(0, 8)}.csv`
}

// --- Davet edilen influencer: brief ---------------------------------------------------------------

async function briefsByIds(ids: string[]): Promise<Map<string, CampaignBrief>> {
  const out = new Map<string, CampaignBrief>()
  const unique = Array.from(new Set(ids.filter(isUuid)))
  const admin = createSupabaseAdminClient()
  if (!admin || unique.length === 0) return out
  const { data, error } = await admin.from('campaigns').select(CAMPAIGN_BRIEF_COLUMNS).in('id', unique.slice(0, 200))
  if (error) {
    console.error('[campaigns] brief okunamadı:', error.message)
    return out
  }
  ;((data ?? []) as unknown as CampaignBrief[]).forEach((b) =>
    out.set(b.id, { ...b, example_links: b.example_links ?? [], hashtags: b.hashtags ?? [], default_deliverables: normalizeDeliverables(b.default_deliverables) }),
  )
  return out
}

/**
 * Tekliflerin kampanya brief'leri. offers, çağıranın oturum istemcisiyle (RLS: alıcı ya da gönderen) okunmuş satırlar
 * olmalıdır; böylece yalnızca kullanıcının taraf olduğu tekliflerin brief'i döner.
 */
export async function briefsForOffers(offers: Array<{ id: string; campaign_id?: string | null }>): Promise<Map<string, CampaignBrief>> {
  const byCampaign = await briefsByIds(offers.map((o) => o.campaign_id ?? '').filter(Boolean))
  const out = new Map<string, CampaignBrief>()
  offers.forEach((o) => {
    const brief = o.campaign_id ? byCampaign.get(o.campaign_id) : undefined
    if (brief) out.set(o.id, brief)
  })
  return out
}

/**
 * İş birliğinin kampanyası (teklif → campaign_id, başvuru → ilan.campaign_id). Çağıran, kullanıcının iş birliğinin tarafı
 * olduğunu önceden doğrulamış olmalıdır (getCollaborationWorkspace RLS'li okumayla doğrular).
 */
export async function campaignBriefForCollaboration(collab: { offer_id: string | null; application_id: string | null }): Promise<CampaignBrief | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  let campaignId: string | null = null
  if (collab.offer_id) {
    const { data } = await admin.from('offers').select('campaign_id').eq('id', collab.offer_id).maybeSingle()
    campaignId = (data?.campaign_id as string | null) ?? null
  } else if (collab.application_id) {
    const { data: app } = await admin.from('advert_applications').select('advert_id').eq('id', collab.application_id).maybeSingle()
    if (app?.advert_id) {
      const { data: advert } = await admin.from('advert_projects').select('campaign_id').eq('id', app.advert_id).maybeSingle()
      campaignId = (advert?.campaign_id as string | null) ?? null
    }
  }
  if (!campaignId) return null
  return (await briefsByIds([campaignId])).get(campaignId) ?? null
}

/** Mobil ve web formlarında kullanılan etiketler (tek kaynak). */
export function targetSummary(c: Pick<CampaignRow, 'target_platforms' | 'target_creator_type' | 'target_cities' | 'min_followers' | 'max_followers'>) {
  const parts: string[] = []
  if (c.target_platforms.length) parts.push(c.target_platforms.map((p) => (p === 'instagram' ? 'Instagram' : 'TikTok')).join(' + '))
  if (c.target_creator_type) parts.push(CAMPAIGN_CREATOR_TYPE_LABELS[c.target_creator_type])
  if (c.target_cities.length) parts.push(c.target_cities.slice(0, 3).join(', ') + (c.target_cities.length > 3 ? ` +${c.target_cities.length - 3}` : ''))
  if (c.min_followers !== null || c.max_followers !== null) {
    parts.push(`${(c.min_followers ?? 0).toLocaleString('tr-TR')}–${c.max_followers !== null ? c.max_followers.toLocaleString('tr-TR') : '∞'} takipçi`)
  }
  return parts.join(' · ')
}
