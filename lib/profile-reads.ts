// Başka kullanıcıların profil verisi (3.17-S2, 2026-10-10 kararı). users ve social_accounts tablolarında istemci
// oturumu yalnızca kendi satırını, admin'i ve ilişkili taraflarını (teklif, sohbet, iş birliği, ilan başvurusu;
// public.my_related_user_ids) okur (migration 20261010000051). Keşif, profil sayfası, vitrin ve ilan sahibi kartları
// gibi diğer profiller yalnızca buradan, service role ile ve kurallar (marka onayı, keşif çarkı) uygulanarak okunur.
// Web sayfaları / server action'ları ve mobil /api/mobile/* uçları aynı fonksiyonları kullanır.
//
// Buradan dönen veride yalnızca herkese açık kart alanları bulunur; gizli kolonlar (e-posta, telefon, vergi, push token,
// bildirim tercihleri vb.) hiçbir zaman seçilmez.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { canBrandViewInfluencer, getWheelState, type WheelState } from '@/lib/discovery-wheel'

/** Liste kartı alanları (keşif, öne çıkanlar, çark). */
export const PROFILE_CARD_COLUMNS =
  'id, full_name, username, avatar_url, category, city, bio, role, spotlight_active, verification_status, displayed_badges, creator_type, is_showcase_visible'

/** Profil sayfası alanları. */
export const PROFILE_DETAIL_COLUMNS = `${PROFILE_CARD_COLUMNS}, social_links`

/** Sosyal hesapların herkese açık alanları (iç tarama alanları seçilmez). */
export const PUBLIC_SOCIAL_COLUMNS =
  'user_id, platform, username, is_verified, has_stats, follower_count, engagement_rate, stats_payload, updated_at, last_scraped_at, created_at'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ID_CHUNK = 100
const DISCOVER_MAX = 500

export type ProfileCard = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  category: string | null
  city: string | null
  bio: string | null
  role: string | null
  spotlight_active: boolean | null
  verification_status: string | null
  displayed_badges: string[] | null
  creator_type: string | null
  is_showcase_visible: boolean | null
}

export type PublicSocialAccount = {
  user_id: string
  platform: string
  username: string | null
  is_verified: boolean | null
  has_stats: boolean | null
  follower_count: number | null
  engagement_rate: number | string | null
  stats_payload: Record<string, unknown> | null
  updated_at: string | null
  last_scraped_at: string | null
  created_at: string | null
}

export type ProfileDetail = ProfileCard & { social_links: Record<string, string | null> | null }

export type ViewerInfo = {
  id: string
  role: 'influencer' | 'brand' | 'admin' | null
  verification_status: 'pending' | 'verified' | 'rejected'
  spotlight_active: boolean | null
  spotlight_plan: string | null
  spotlight_expires_at: string | null
  category: string | null
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Başka kullanıcıların herkese açık alanlarını okuyan istemci (service role). Yoksa (yapılandırma hatası) verilen
 * oturum istemcisi kullanılır; o durumda RLS yalnızca kendi / ilişkili satırları döndürür. Çağıran oturumu ve
 * kuralları önceden doğrulamış olmalıdır.
 */
export function profileReader(fallback?: SupabaseClient | null): SupabaseClient | null {
  return createSupabaseAdminClient() ?? fallback ?? null
}

/** Oturum sahibinin kendi satırı (RLS: kendi satırı her zaman okunur). */
export async function getViewerInfo(supabase: SupabaseClient, userId: string): Promise<ViewerInfo | null> {
  const { data } = await supabase
    .from('users')
    .select('id, role, verification_status, spotlight_active, spotlight_plan, spotlight_expires_at, category')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  const role = data.role === 'brand' || data.role === 'influencer' || data.role === 'admin' ? data.role : null
  const status = data.verification_status === 'verified' || data.verification_status === 'rejected' ? data.verification_status : 'pending'
  return {
    id: data.id as string,
    role,
    verification_status: status,
    spotlight_active: (data.spotlight_active as boolean | null) ?? null,
    spotlight_plan: (data.spotlight_plan as string | null) ?? null,
    spotlight_expires_at: (data.spotlight_expires_at as string | null) ?? null,
    category: (data.category as string | null) ?? null,
  }
}

/** Kullanıcı adı başka bir hesapta kullanılıyor mu? (yalnızca evet/hayır; satır döndürülmez) */
export async function isUsernameTaken(normalizedUsername: string, excludeUserId?: string | null): Promise<boolean> {
  const reader = profileReader()
  if (!reader) throw new Error('Kullanıcı adı kontrol edilemedi.')
  let query = reader.from('users').select('id').eq('username', normalizedUsername).limit(1)
  if (excludeUserId) query = query.neq('id', excludeUserId)
  const { data, error } = await query
  if (error) throw new Error('Kullanıcı adı kontrol edilemedi.')
  return (data?.length ?? 0) > 0
}

/** Verilen kimliklerin herkese açık sosyal hesapları (kullanıcı başına liste). */
export async function getPublicSocialAccounts(
  userIds: string[],
  options: { verifiedOnly?: boolean } = {},
): Promise<Map<string, PublicSocialAccount[]>> {
  const out = new Map<string, PublicSocialAccount[]>()
  const ids = Array.from(new Set(userIds.filter((id) => UUID_RE.test(id))))
  const reader = profileReader()
  if (!reader || ids.length === 0) return out
  const results = await Promise.all(
    chunk(ids, ID_CHUNK).map((part) => {
      let query = reader.from('social_accounts').select(PUBLIC_SOCIAL_COLUMNS).in('user_id', part)
      if (options.verifiedOnly) query = query.eq('is_verified', true)
      return query
    }),
  )
  for (const result of results) {
    if (result.error) {
      console.error('[profile-reads] sosyal hesaplar okunamadı:', result.error.message)
      continue
    }
    for (const row of (result.data ?? []) as unknown as PublicSocialAccount[]) {
      const list = out.get(row.user_id) ?? []
      list.push(row)
      out.set(row.user_id, list)
    }
  }
  return out
}

/** Keşifte gösterilebilecek (onaylı, vitrinde) influencer/UGC kartları; kimlik sırası korunur. */
async function discoverableCardsByIds(reader: SupabaseClient, ids: string[]): Promise<ProfileCard[]> {
  const unique = Array.from(new Set(ids.filter((id) => UUID_RE.test(id))))
  if (unique.length === 0) return []
  const results = await Promise.all(
    chunk(unique, ID_CHUNK).map((part) =>
      reader
        .from('users')
        .select(PROFILE_CARD_COLUMNS)
        .in('id', part)
        .eq('role', 'influencer')
        .eq('verification_status', 'verified')
        .eq('is_showcase_visible', true),
    ),
  )
  const rows: ProfileCard[] = []
  for (const result of results) {
    if (result.error) throw new Error(result.error.message)
    rows.push(...((result.data ?? []) as unknown as ProfileCard[]))
  }
  return rows.sort((a, b) => unique.indexOf(a.id) - unique.indexOf(b.id))
}

export type WheelPayload =
  | { limited: false }
  | {
      limited: true
      profilesPerSpin: number
      windowHours: number
      spin: { created_at: string; expires_at: string } | null
    }

export function wheelPayloadOf(state: WheelState): WheelPayload {
  if (!state.limited) return { limited: false }
  return {
    limited: true,
    profilesPerSpin: state.profilesPerSpin,
    windowHours: state.windowHours,
    spin: state.spin ? { created_at: state.spin.created_at, expires_at: state.spin.expires_at } : null,
  }
}

/** Güncel çevirmedeki profil kartları (çark sınırı yoksa boş). */
export async function getWheelProfileCards(state: WheelState): Promise<ProfileCard[]> {
  if (!state.limited || !state.spin || state.spin.influencer_ids.length === 0) return []
  const reader = profileReader()
  if (!reader) return []
  return discoverableCardsByIds(reader, state.spin.influencer_ids)
}

export type DiscoverProfile = ProfileCard & { social_accounts: PublicSocialAccount[] }

export type DiscoverResult =
  | { locked: true; verificationStatus: ViewerInfo['verification_status']; limited: false; profiles: [] }
  | (WheelPayload & { locked: false; profiles: DiscoverProfile[] })

/**
 * Keşif / öne çıkanlar listesi (mobil Keşfet ve marka ana sayfası; web keşif sayfasıyla aynı kural):
 * onaysız marka hiçbir profil görmez; ücretsiz marka (sınırlar açıkken) yalnızca güncel çarktaki profilleri görür;
 * diğerleri onaylı, vitrinde ve en az bir doğrulanmış sosyal hesabı olan influencer/UGC profillerini görür.
 */
export async function listDiscoverProfiles(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number } = {},
): Promise<DiscoverResult | { error: string }> {
  const viewer = await getViewerInfo(supabase, userId)
  if (!viewer) return { error: 'Profil bulunamadı.' }
  if (viewer.role === 'brand' && viewer.verification_status !== 'verified') {
    return { locked: true, verificationStatus: viewer.verification_status, limited: false, profiles: [] }
  }
  const reader = profileReader()
  if (!reader) return { error: 'Sistem yapılandırma hatası.' }

  const limit = Math.min(Math.max(1, Math.floor(options.limit ?? DISCOVER_MAX)), DISCOVER_MAX)
  try {
    const state = viewer.role === 'brand' ? await getWheelState(userId) : ({ limited: false } as WheelState)
    let cards: ProfileCard[]
    if (state.limited) {
      cards = await getWheelProfileCards(state)
    } else {
      // Doğrulanmış hesap şartı sonradan uygulandığı için aday sayısı biraz geniş tutulur.
      const { data, error } = await reader
        .from('users')
        .select(PROFILE_CARD_COLUMNS)
        .eq('role', 'influencer')
        .eq('verification_status', 'verified')
        .eq('is_showcase_visible', true)
        .neq('id', userId)
        .order('spotlight_active', { ascending: false })
        .order('full_name', { ascending: true })
        .limit(Math.min(DISCOVER_MAX, limit * 3))
      if (error) throw new Error(error.message)
      cards = (data ?? []) as unknown as ProfileCard[]
    }

    const socials = await getPublicSocialAccounts(
      cards.map((card) => card.id),
      { verifiedOnly: true },
    )
    const profiles = cards
      .map((card) => ({ ...card, social_accounts: socials.get(card.id) ?? [] }))
      .filter((profile) => profile.social_accounts.length > 0)
      .slice(0, limit)
    return { ...wheelPayloadOf(state), locked: false, profiles }
  } catch (error) {
    console.error('[profile-reads] keşif listesi okunamadı:', error)
    return { error: 'Profiller yüklenemedi. Lütfen tekrar deneyin.' }
  }
}

export type ProfileAccess =
  | { status: 'not_found' }
  | { status: 'brand_unverified'; viewer: ViewerInfo }
  | { status: 'wheel_blocked'; viewer: ViewerInfo; wheel: Extract<WheelState, { limited: true }> }
  | {
      status: 'ok'
      viewer: ViewerInfo
      profile: ProfileDetail
      socialAccounts: PublicSocialAccount[]
      wheel: WheelState
    }

/**
 * Profil sayfası / mobil profil detayı. Kurallar (web profil sayfasıyla aynı):
 * - oturum gerekir (viewer satırı yoksa bulunamadı sayılır);
 * - onaysız marka profil görmez (kendi profili dahil, bugünkü davranış);
 * - ücretsiz marka (sınırlar açıkken) influencer profilini yalnızca çarktaysa ya da daha önce teklif / iş birliği /
 *   sohbet / ilan başvurusu ilişkisi varsa açar.
 * Profil ya kimlikle ya kullanıcı adıyla aranır.
 */
export async function getProfileForViewer(
  supabase: SupabaseClient,
  viewerId: string,
  key: { id?: string | null; username?: string | null },
): Promise<ProfileAccess> {
  const viewer = await getViewerInfo(supabase, viewerId)
  if (!viewer) return { status: 'not_found' }
  const reader = profileReader()
  if (!reader) return { status: 'not_found' }

  let query = reader.from('users').select(PROFILE_DETAIL_COLUMNS)
  if (key.id) {
    if (!UUID_RE.test(key.id)) return { status: 'not_found' }
    query = query.eq('id', key.id)
  } else if (key.username) {
    query = query.eq('username', key.username)
  } else {
    return { status: 'not_found' }
  }
  const { data, error } = await query.maybeSingle()
  if (error || !data) return { status: 'not_found' }
  const profile = data as unknown as ProfileDetail

  if (viewer.role === 'brand' && viewer.verification_status !== 'verified') return { status: 'brand_unverified', viewer }

  let wheel: WheelState = { limited: false }
  if (viewer.role === 'brand' && profile.role === 'influencer' && profile.id !== viewer.id) {
    wheel = await getWheelState(viewer.id)
    if (wheel.limited && !(await canBrandViewInfluencer(viewer.id, profile.id, wheel))) {
      return { status: 'wheel_blocked', viewer, wheel }
    }
  }

  const socials = await getPublicSocialAccounts([profile.id])
  return { status: 'ok', viewer, profile, socialAccounts: socials.get(profile.id) ?? [], wheel }
}

/**
 * İlan sahibi marka kartları (ilan listeleri). Yalnızca en az bir ilanı olan kullanıcıların kartı döner; başka
 * kimlikler sessizce atlanır (ilan listesi dışında profil okumak için kullanılamaz).
 */
export async function getAdvertOwnerCards<T extends Record<string, unknown> = Record<string, unknown>>(
  ownerIds: string[],
  columns = 'id, full_name, username, avatar_url, company_legal_name, displayed_badges, verification_status, spotlight_active, spotlight_expires_at',
): Promise<T[]> {
  const ids = Array.from(new Set(ownerIds.filter((id) => typeof id === 'string' && UUID_RE.test(id))))
  const reader = profileReader()
  if (!reader || ids.length === 0) return []
  const owners = new Set<string>()
  for (const part of chunk(ids, ID_CHUNK)) {
    const { data, error } = await reader.from('advert_projects').select('brand_user_id').in('brand_user_id', part)
    if (error) {
      console.error('[profile-reads] ilan sahipleri okunamadı:', error.message)
      return []
    }
    ;(data ?? []).forEach((row) => owners.add(row.brand_user_id as string))
  }
  const ownerIdList = Array.from(owners)
  if (ownerIdList.length === 0) return []
  const rows: T[] = []
  for (const part of chunk(ownerIdList, ID_CHUNK)) {
    const { data, error } = await reader.from('users').select(columns).in('id', part)
    if (error) {
      console.error('[profile-reads] ilan sahibi kartları okunamadı:', error.message)
      return []
    }
    rows.push(...((data ?? []) as unknown as T[]))
  }
  return rows
}

const OPEN_ADVERT_COLUMNS =
  'id, title, summary, category, brand_name, budget_currency, budget_min, budget_max, platforms, deliverables, location, hero_image, deadline, status, created_at, brand_user_id'

/** Açık ilanlar ve ilan sahibi kartları (mobil İlanlar ekranı; web ilan sayfalarıyla aynı alanlar). İlanlar oturumla (RLS) okunur. */
export async function listOpenAdvertsWithOwners(
  supabase: SupabaseClient,
  limit = 40,
): Promise<{ adverts: Record<string, unknown>[] } | { error: string }> {
  const { data: rows, error } = await supabase
    .from('advert_projects')
    .select(OPEN_ADVERT_COLUMNS)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(1, Math.floor(limit) || 40), 100))
  if (error) return { error: 'İlanlar yüklenemedi.' }
  const owners = await getAdvertOwnerCards<{ id: string }>(
    (rows ?? []).map((row) => row.brand_user_id as string),
    'id, full_name, company_legal_name, avatar_url, verification_status',
  )
  const ownerMap = new Map(owners.map((owner) => [owner.id, owner]))
  return {
    adverts: (rows ?? []).map((row) => ({ ...row, brand: ownerMap.get(row.brand_user_id as string) ?? null })),
  }
}
