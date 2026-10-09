// Keşif çarkı (yol haritası adım 3, 2026-10-10 kararı). Bayrak açıkken ücretsiz marka tüm influencer/UGC listesini
// görmez: pencere başına (varsayılan 24 saat) bir kez çarkı çevirir, sektörüne uygun N doğrulanmış profil
// (lib/category-map.ts; yetmezse diğer doğrulanmış profiller) pencere boyunca görünür. Önceki çevirmelerde gösterilen
// profiller havuz bitene kadar tekrar gelmez. Spotlight markalar herkesi görür. Bayrak kapalıyken hiçbir şey değişmez.
//
// Tablo public.discovery_spins: marka yalnızca kendi satırlarını okur (RLS), yazım yalnızca burada (service role).
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getBrandLimitContext, type BrandLimitContext } from '@/lib/brand-limits'
import { influencerCategoriesForBrand, normalizeInfluencerCategory } from '@/lib/category-map'

export interface DiscoverySpin {
  id: string
  influencer_ids: string[]
  created_at: string
  expires_at: string
}

export type WheelState =
  | { limited: false }
  | {
      limited: true
      profilesPerSpin: number
      windowHours: number
      /** Süresi dolmamış çevirme; yoksa null (marka çarkı çevirebilir). */
      spin: DiscoverySpin | null
    }

/** Önceki çevirmelerden en fazla bu kadarı "gösterildi" sayılır (tekrar önleme). */
const SEEN_SPIN_LOOKBACK = 200
const POOL_LIMIT = 5000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function latestActiveSpin(admin: SupabaseClient, brandId: string): Promise<DiscoverySpin | null> {
  const { data, error } = await admin
    .from('discovery_spins')
    .select('id, influencer_ids, created_at, expires_at')
    .eq('brand_id', brandId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as DiscoverySpin | null) ?? null
}

/** Markanın çark durumu. Sınır yoksa (bayrak kapalı, Spotlight, marka değil) { limited: false }. */
export async function getWheelState(userId: string, ctx?: BrandLimitContext): Promise<WheelState> {
  const context = ctx ?? (await getBrandLimitContext(userId))
  if (!context.active || !context.wheel) return { limited: false }
  const admin = createSupabaseAdminClient()
  if (!admin) return { limited: false }
  return {
    limited: true,
    profilesPerSpin: context.settings.wheel_profiles_per_day,
    windowHours: context.settings.wheel_window_hours,
    spin: await latestActiveSpin(admin, userId),
  }
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Keşifte gösterilebilecek profiller: onaylı, vitrinde, en az bir doğrulanmış sosyal hesabı olan influencer/UGC. */
async function eligiblePool(admin: SupabaseClient): Promise<{ id: string; category: string | null }[]> {
  const [{ data: users, error: usersError }, { data: socials, error: socialsError }] = await Promise.all([
    admin
      .from('users')
      .select('id, category')
      .eq('role', 'influencer')
      .eq('verification_status', 'verified')
      .eq('is_showcase_visible', true)
      .limit(POOL_LIMIT),
    admin.from('social_accounts').select('user_id').eq('is_verified', true).limit(POOL_LIMIT * 3),
  ])
  if (usersError) throw new Error(usersError.message)
  if (socialsError) throw new Error(socialsError.message)
  const withAccount = new Set((socials ?? []).map((row) => row.user_id as string))
  return (users ?? [])
    .filter((user) => withAccount.has(user.id as string))
    .map((user) => ({ id: user.id as string, category: (user.category as string | null) ?? null }))
}

/**
 * Çarkı çevirir. Süresi dolmamış çevirme varsa onu döndürür (pencere başına bir kez).
 * Seçim: önce marka sektörüne uyan ve daha önce gösterilmemiş profiller, yetmezse diğer gösterilmemiş doğrulanmış
 * profiller; havuz biterse gösterilmişler yeniden kullanılır (son çevirmedekiler en sona).
 */
export async function spinWheel(
  userId: string,
): Promise<{ success: true; spin: DiscoverySpin; alreadyActive: boolean } | { error: string }> {
  const context = await getBrandLimitContext(userId)
  if (!context.active || !context.wheel) return { error: 'Keşif çarkı yalnızca ücretsiz marka hesaplarında kullanılır.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }

  try {
    const { data: brand } = await admin.from('users').select('role, verification_status, category').eq('id', userId).maybeSingle()
    if (brand?.role !== 'brand') return { error: 'Keşif çarkı yalnızca marka hesaplarında kullanılır.' }
    if (brand.verification_status !== 'verified') {
      return { error: 'Hesabınız henüz onaylanmadı. Profilleri görebilmek için hesabınızın onaylanması gerekmektedir.' }
    }

    const active = await latestActiveSpin(admin, userId)
    if (active) return { success: true, spin: active, alreadyActive: true }

    const count = context.settings.wheel_profiles_per_day
    const pool = await eligiblePool(admin)
    if (pool.length === 0) return { error: 'Şu an gösterilebilecek doğrulanmış profil yok. Daha sonra tekrar deneyin.' }

    const { data: previous, error: previousError } = await admin
      .from('discovery_spins')
      .select('influencer_ids')
      .eq('brand_id', userId)
      .order('created_at', { ascending: false })
      .limit(SEEN_SPIN_LOOKBACK)
    if (previousError) throw new Error(previousError.message)
    const seen = new Set((previous ?? []).flatMap((row) => (row.influencer_ids as string[] | null) ?? []))
    const lastSpin = new Set(((previous?.[0]?.influencer_ids as string[] | null) ?? []))

    const targets = new Set(influencerCategoriesForBrand(brand.category as string | null))
    const matches = (category: string | null) => {
      if (targets.size === 0) return false
      const key = normalizeInfluencerCategory(category)
      return !!key && targets.has(key)
    }
    const categoryPool = pool.filter((p) => matches(p.category)).map((p) => p.id)
    const otherPool = pool.filter((p) => !matches(p.category)).map((p) => p.id)

    const picked: string[] = []
    const take = (ids: string[]) => {
      for (const id of ids) {
        if (picked.length >= count) return
        if (!picked.includes(id)) picked.push(id)
      }
    }
    take(shuffle(categoryPool.filter((id) => !seen.has(id))))
    take(shuffle(otherPool.filter((id) => !seen.has(id))))
    if (picked.length < count) {
      // Havuz bitti: gösterilmişler yeniden; önce sektöre uyanlar, son çevirmede görülenler en sona.
      const recycle = (ids: string[]) => {
        const shuffled = shuffle(ids)
        return [...shuffled.filter((id) => !lastSpin.has(id)), ...shuffled.filter((id) => lastSpin.has(id))]
      }
      take(recycle(categoryPool))
      take(recycle(otherPool))
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + context.settings.wheel_window_hours * 60 * 60 * 1000)
    const { data: created, error: insertError } = await admin
      .from('discovery_spins')
      .insert({ brand_id: userId, influencer_ids: picked, created_at: now.toISOString(), expires_at: expiresAt.toISOString() })
      .select('id, influencer_ids, created_at, expires_at')
      .single()
    if (insertError || !created) throw new Error(insertError?.message ?? 'insert failed')
    return { success: true, spin: created as DiscoverySpin, alreadyActive: false }
  } catch (error) {
    console.error('[discovery-wheel] spin error:', error)
    return { error: 'Çark çevrilemedi. Lütfen tekrar deneyin.' }
  }
}

/** Marka ile influencer arasında teklif, iş birliği, sohbet odası ya da ilan başvurusu var mı? */
async function hasRelationship(admin: SupabaseClient, brandId: string, influencerId: string): Promise<boolean> {
  // Kimlik sorgu filtresine (or) yazıldığı için yalnızca UUID kabul edilir.
  if (!UUID_RE.test(influencerId)) return false
  const exists = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await query
    if (error) throw new Error(error.message)
    return (count ?? 0) > 0
  }
  const head = { count: 'exact' as const, head: true }
  const checks = await Promise.all([
    exists(admin.from('offers').select('id', head).eq('sender_user_id', brandId).eq('receiver_user_id', influencerId)),
    exists(admin.from('collaborations').select('id', head).eq('brand_id', brandId).eq('influencer_id', influencerId)),
    exists(admin.from('rooms').select('id', head).eq('brand_id', brandId).eq('influencer_id', influencerId)),
  ])
  if (checks.some(Boolean)) return true

  const { data: adverts, error } = await admin.from('advert_projects').select('id').eq('brand_user_id', brandId).limit(500)
  if (error) throw new Error(error.message)
  const advertIds = (adverts ?? []).map((row) => row.id as string)
  if (advertIds.length === 0) return false
  return exists(
    admin
      .from('advert_applications')
      .select('id', head)
      .in('advert_id', advertIds)
      .or(`influencer_id.eq.${influencerId},influencer_user_id.eq.${influencerId}`),
  )
}

/**
 * Marka bu influencer profilini açabilir mi? Sınır yoksa her zaman evet. Ücretsiz markada: güncel çevirmedeki profiller
 * ve daha önce teklif / iş birliği / sohbet / ilan başvurusu ilişkisi olanlar. Okuma hatasında açık bırakılır (bugünkü davranış).
 */
export async function canBrandViewInfluencer(userId: string, influencerId: string, state?: WheelState): Promise<boolean> {
  try {
    const wheel = state ?? (await getWheelState(userId))
    if (!wheel.limited) return true
    if (wheel.spin?.influencer_ids.includes(influencerId)) return true
    const admin = createSupabaseAdminClient()
    if (!admin) return true
    return await hasRelationship(admin, userId, influencerId)
  } catch (error) {
    console.error('[discovery-wheel] access check error:', error)
    return true
  }
}
