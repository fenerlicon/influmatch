// Sosyal hesap doğrulama ve istatistik yenileme mantığı.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: buradaki fonksiyonlar kimlik kontrolü yapmaz
// ve istemciden doğrudan çağrılamamalıdır. Sadece yetki kontrolü yapan server action'lar,
// API route'ları (mobil, cron) ve server component'ler tarafından kullanılır.

import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchInstagramData } from '@/utils/instagram-service'
import { fetchTikTokPublicProfile } from '@/utils/tiktok-service'
import { syncBlueTick } from '@/lib/blue-tick'

export type SocialPlatform = 'instagram' | 'tiktok'

export type SocialResult = {
  success: boolean
  error?: string
  code?: string
  message?: string
  data?: Record<string, any>
}

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

// Apify harcama sınırları (her kazıma ücretli bir koşudur).
const SCRAPE_LOCK_MS = 3 * 60 * 1000 // aynı hesap için aynı anda tek koşu
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000
const MAX_ATTEMPTS_PER_WINDOW = 6 // hesap başına saatte en fazla 6 koşu
const MIN_USER_REFRESH_MS = 24 * 60 * 60 * 1000 // doğrulanmış hesap: kullanıcı isteğiyle günde 1 yenileme

/** 'user': kullanıcı tetikledi (sıkı sınırlar). 'auto': dashboard/cron bayat veri yenilemesi. */
export type ScrapeSource = 'user' | 'auto'

const ACCOUNT_COLUMNS =
  'id, username, verification_code, is_verified, last_scraped_at, scrape_lock_until, scrape_attempts, scrape_window_started_at'

type ScrapeAccount = {
  id: string
  username: string
  verification_code: string | null
  is_verified: boolean | null
  last_scraped_at: string | null
  scrape_lock_until: string | null
  scrape_attempts: number | null
  scrape_window_started_at: string | null
}

const OUTAGE_ERROR_NAMES = new Set(['ApiPoolExhaustedError', 'ApiServiceError', 'ApiKeyError'])

/** Servis kesintisi mi (kredi/anahtar bitti, Apify çöktü), yoksa hesaba özel bir hata mı (gizli, silinmiş hesap). */
export function isServiceOutage(error: unknown): boolean {
  let current: any = error
  for (let depth = 0; current && depth < 4; depth++) {
    if (OUTAGE_ERROR_NAMES.has(current.name)) return true
    current = current.cause
  }
  return false
}

function minutesUntil(ms: number) {
  return Math.max(1, Math.ceil(ms / 60000))
}

/**
 * Ücretli kazıma için hesabın kilidini alır. Kilit tek bir koşullu UPDATE ile alınır, yani
 * aynı anda gelen iki istekten yalnızca biri kazanır. Deneme sayacı kilit tutulurken artırılır.
 */
export async function acquireScrapeSlot(
  admin: SupabaseClient,
  account: ScrapeAccount,
  source: ScrapeSource,
  now = Date.now(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (source === 'user' && account.is_verified && account.last_scraped_at) {
    const sinceLast = now - new Date(account.last_scraped_at).getTime()
    if (sinceLast < MIN_USER_REFRESH_MS) {
      const hours = Math.max(1, Math.ceil((MIN_USER_REFRESH_MS - sinceLast) / 3600000))
      return { ok: false, error: `İstatistikler günde en fazla bir kez yenilenebilir. Yaklaşık ${hours} saat sonra tekrar deneyin.` }
    }
  }

  const windowStart = account.scrape_window_started_at ? new Date(account.scrape_window_started_at).getTime() : 0
  const inWindow = now - windowStart < ATTEMPT_WINDOW_MS
  const attempts = inWindow ? account.scrape_attempts ?? 0 : 0
  if (attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    return {
      ok: false,
      error: `Çok fazla deneme yapıldı. Lütfen ${minutesUntil(windowStart + ATTEMPT_WINDOW_MS - now)} dakika sonra tekrar deneyin.`,
    }
  }

  const nowIso = new Date(now).toISOString()
  const { data, error } = await admin
    .from('social_accounts')
    .update({
      scrape_lock_until: new Date(now + SCRAPE_LOCK_MS).toISOString(),
      scrape_attempts: attempts + 1,
      scrape_window_started_at: inWindow ? account.scrape_window_started_at : nowIso,
    })
    .eq('id', account.id)
    .or(`scrape_lock_until.is.null,scrape_lock_until.lt.${nowIso}`)
    .select('id')

  if (error) {
    console.error('[acquireScrapeSlot] DB error:', error)
    return { ok: false, error: 'Hesap şu anda güncellenemiyor. Lütfen biraz sonra tekrar deneyin.' }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Hesabınız şu anda güncelleniyor. Lütfen bir dakika sonra tekrar deneyin.' }
  }
  return { ok: true }
}

async function releaseScrapeSlot(admin: SupabaseClient, accountId: string) {
  const { error } = await admin.from('social_accounts').update({ scrape_lock_until: null }).eq('id', accountId)
  if (error) console.error('[releaseScrapeSlot] DB error:', error)
}

const BASIC_ACCOUNT_COLUMNS = 'id, username, verification_code, is_verified, last_scraped_at'

/** Hesabı okur. Kilit kolonları henüz yoksa (migration 20261007000002 çalışmadıysa) sınırsız moda düşer. */
async function fetchScrapeAccount(admin: SupabaseClient, userId: string, platform: SocialPlatform) {
  const full = await admin.from('social_accounts').select(ACCOUNT_COLUMNS).eq('user_id', userId).eq('platform', platform).maybeSingle()
  if (full.error?.code === '42703') {
    console.warn('[social-stats] scrape throttle columns missing; run migration 20261007000002_scrape_throttle.sql')
    const basic = await admin.from('social_accounts').select(BASIC_ACCOUNT_COLUMNS).eq('user_id', userId).eq('platform', platform).maybeSingle()
    return { account: basic.data as ScrapeAccount | null, error: basic.error, throttled: false }
  }
  return { account: full.data as ScrapeAccount | null, error: full.error, throttled: true }
}

async function withScrapeSlot(
  admin: SupabaseClient,
  account: ScrapeAccount,
  source: ScrapeSource,
  task: () => Promise<SocialResult>,
  throttled = true,
): Promise<SocialResult> {
  if (!throttled) return task()
  const slot = await acquireScrapeSlot(admin, account, source)
  if (!slot.ok) return { success: false, code: 'rate_limited', error: slot.error }
  try {
    return await task()
  } finally {
    await releaseScrapeSlot(admin, account.id)
  }
}

function getAdminClient(): SupabaseClient {
  const client = createSupabaseAdminClient()
  if (!client) {
    throw new Error('Sunucu yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
  }
  return client
}

function normalizeCode(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function bioContainsCode(bio: string | null | undefined, code: string | null | undefined) {
  const cleanCode = normalizeCode(code)
  // Boş kod her biyografide "bulunur"; bu yüzden asla kabul edilmez.
  if (cleanCode.length < 6) return false
  return normalizeCode(bio).includes(cleanCode)
}

export function normalizeInstagramUsername(raw: string) {
  let value = raw.trim().replace(/^@/, '')
  if (value.includes('instagram.com/')) {
    value = value.split('instagram.com/')[1].split('?')[0].split('/')[0]
  }
  return value.toLowerCase()
}

export function normalizeTikTokUsername(raw: string) {
  let value = raw.replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase().replace('@', '').trim()
  if (value.includes('tiktok.com/')) {
    value = value.split('tiktok.com/')[1].split('?')[0].split('/')[0].replace('@', '').trim()
  }
  return value
}

/**
 * Kullanıcı için yeni bir doğrulama kodu üretir. Hesap (yeniden) doğrulanmamış duruma çekilir;
 * kullanıcı adını değiştirmenin tek yolu budur, böylece doğrulanmış bir hesabın
 * kullanıcı adı başka bir hesapla değiştirilemez.
 */
export async function issueVerificationCode(
  userId: string,
  platform: SocialPlatform,
  rawUsername: string,
): Promise<SocialResult> {
  const username =
    platform === 'instagram' ? normalizeInstagramUsername(rawUsername) : normalizeTikTokUsername(rawUsername)

  if (!username || !/^[a-z0-9._]{1,30}$/.test(username)) {
    return { success: false, error: 'Geçersiz kullanıcı adı.' }
  }

  const admin = getAdminClient()

  const { data: conflict } = await admin
    .from('social_accounts')
    .select('user_id')
    .eq('platform', platform)
    .ilike('username', username)
    .eq('is_verified', true)
    .neq('user_id', userId)
    .maybeSingle()

  if (conflict) {
    return {
      success: false,
      error: 'Bu hesap sistemde başka bir doğrulanmış kullanıcıya bağlı. Aynı hesap birden fazla profile bağlanamaz.',
    }
  }

  // Aynı hesap zaten doğrulanmışsa yeni kod üretmek doğrulamayı düşürmemeli (tek hesabı olan
  // influencer dashboard'dan kilitlenirdi). Farklı bir hesaba geçiş bilinçli bir değişikliktir.
  const { data: current } = await admin
    .from('social_accounts')
    .select('username, is_verified, verification_code')
    .eq('user_id', userId)
    .eq('platform', platform)
    .maybeSingle()
  if (current?.is_verified && String(current.username ?? '').toLowerCase() === username) {
    return { success: false, code: 'already_verified', error: 'Bu hesap zaten doğrulanmış.' }
  }

  const code = `${platform === 'instagram' ? 'IM' : 'IM-TT'}-${randomInt(100000, 1000000)}`

  const { error } = await admin.from('social_accounts').upsert(
    {
      user_id: userId,
      platform,
      username,
      verification_code: code,
      is_verified: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id, platform' },
  )

  if (error) {
    console.error('[issueVerificationCode] DB error:', error)
    return { success: false, error: 'Doğrulama kodu oluşturulamadı. Lütfen tekrar deneyin.' }
  }

  return { success: true, code }
}

async function syncProfileAfterVerification(
  admin: SupabaseClient,
  userId: string,
  platform: SocialPlatform,
  profileUrl: string,
  avatarUrl: string | null | undefined,
) {
  try {
    const { data: userProfile } = await admin
      .from('users')
      .select('social_links, avatar_url')
      .eq('id', userId)
      .single()

    const currentLinks = (userProfile?.social_links as Record<string, string | null> | null) ?? {}
    const updateFields: Record<string, any> = { social_links: { ...currentLinks, [platform]: profileUrl } }
    if (!userProfile?.avatar_url && avatarUrl) {
      updateFields.avatar_url = avatarUrl
    }

    await admin.from('users').update(updateFields).eq('id', userId)
  } catch (syncError) {
    console.error(`[syncProfileAfterVerification] ${platform} sync error:`, syncError)
  }

  // Hesap doğrulaması mavi tik vermez (kayıtta herkes için zorunlu). Güncel istatistiklerle
  // mavi tik kuralı (Spotlight + performans + güven) yeniden değerlendirilir.
  await syncBlueTick(userId, admin)
}

/**
 * Instagram hesabını doğrular (ilk sefer: biyografide kod aranır) veya
 * doğrulanmış hesabın istatistiklerini yeniler.
 */
export async function refreshInstagramAccount(userId: string, source: ScrapeSource = 'user'): Promise<SocialResult> {
  const admin = getAdminClient()

  const { account, error: fetchError, throttled } = await fetchScrapeAccount(admin, userId, 'instagram')

  if (fetchError || !account) {
    return { success: false, error: 'Hesap bulunamadı.' }
  }

  return withScrapeSlot(admin, account, source, () => scrapeInstagram(admin, userId, account), throttled)
}

async function scrapeInstagram(admin: SupabaseClient, userId: string, account: ScrapeAccount): Promise<SocialResult> {
  let normalizedData
  try {
    normalizedData = await fetchInstagramData(account.username)
  } catch (apiError: any) {
    console.error('[refreshInstagramAccount] Instagram service error:', apiError)
    return {
      success: false,
      code: isServiceOutage(apiError) ? 'service_unavailable' : 'scrape_failed',
      error: apiError.message || 'Instagram verileri çekilemedi. Lütfen daha sonra tekrar deneyin.',
    }
  }

  const user = normalizedData.user

  if (!account.is_verified && !bioContainsCode(user.biography, account.verification_code)) {
    return {
      success: false,
      error: `Doğrulama kodu (${account.verification_code}) biyografinizde bulunamadı. Lütfen kodu değiştirmeden biyografinize eklediğinizden emin olun.`,
    }
  }

  const platformUserId = user.id ? String(user.id) : null
  if (platformUserId) {
    const { data: existingConflict } = await admin
      .from('social_accounts')
      .select('user_id')
      .eq('platform', 'instagram')
      .eq('platform_user_id', platformUserId)
      .neq('user_id', userId)
      .maybeSingle()

    if (existingConflict) {
      return { success: false, error: 'Bu Instagram hesabı sistemde zaten kayıtlı (başka bir kullanıcıda).' }
    }
  }

  // İstatistikler: sabitlenmiş gönderiler ve 30 günden eski gönderiler hariç, en fazla 24 gönderi.
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
  const analyzedPosts = (normalizedData.recent_posts || [])
    .map((edge: any) => edge.node)
    .filter((node: any) => {
      if (node.is_pinned === true || node.isPinned === true) return false
      if (node.pinned_for_users && node.pinned_for_users.length > 0) return false
      return (Number(node?.taken_at_timestamp) || 0) >= thirtyDaysAgo
    })
    .sort((a: any, b: any) => (Number(b.taken_at_timestamp) || 0) - (Number(a.taken_at_timestamp) || 0))
    .slice(0, 24)

  let avgLikes = 0
  let avgComments = 0
  let avgViews = 0
  let engagementRate = 0
  let averageIntervalDays = 0
  const followerCount = user.follower_count

  if (analyzedPosts.length > 0) {
    const totalLikes = analyzedPosts.reduce((sum: number, post: any) => sum + (post.edge_liked_by?.count || 0), 0)
    const totalComments = analyzedPosts.reduce((sum: number, post: any) => sum + (post.edge_media_to_comment?.count || 0), 0)

    const videoPosts = analyzedPosts.filter((post: any) => post.is_video)
    if (videoPosts.length > 0) {
      const totalViews = videoPosts.reduce((sum: number, post: any) => sum + (Number(post.video_view_count) || 0), 0)
      avgViews = Math.round(totalViews / videoPosts.length)
    }

    avgLikes = Math.round(totalLikes / analyzedPosts.length)
    avgComments = Math.round(totalComments / analyzedPosts.length)

    if (followerCount > 0) {
      // DB numeric taşmasını önlemek için 999.99 ile sınırla
      const rawRate = ((avgLikes + avgComments) / followerCount) * 100
      engagementRate = Math.min(parseFloat(rawRate.toFixed(2)), 999.99)
    }

    if (analyzedPosts.length > 1) {
      const newest = Number(analyzedPosts[0].taken_at_timestamp)
      const oldest = Number(analyzedPosts[analyzedPosts.length - 1].taken_at_timestamp)
      averageIntervalDays = Math.round((newest - oldest) / (60 * 60 * 24) / (analyzedPosts.length - 1))
    }
  }

  const statsPayload = {
    avg_likes: avgLikes,
    avg_comments: avgComments,
    avg_views: avgViews,
    following_count: user.following_count,
    post_count: user.media_count,
    is_verified: user.is_verified,
    category_name: user.category_name,
    is_business_account: user.is_business_account,
    external_url: user.external_url,
    posting_frequency: averageIntervalDays,
  }

  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .from('social_accounts')
    .update({
      username: user.username,
      is_verified: true,
      platform_user_id: platformUserId,
      follower_count: followerCount,
      engagement_rate: engagementRate,
      has_stats: true,
      stats_payload: statsPayload,
      last_scraped_at: now,
      updated_at: now,
    })
    .eq('id', account.id)

  if (updateError) {
    console.error('[refreshInstagramAccount] Update error:', updateError)
    return { success: false, error: 'Hesap güncellenemedi. Lütfen tekrar deneyin.' }
  }

  const { error: historyError } = await admin.from('social_account_history').insert({
    social_account_id: account.id,
    follower_count: followerCount,
    engagement_rate: engagementRate,
    avg_likes: avgLikes,
    avg_comments: avgComments,
    avg_views: avgViews,
    recorded_at: now,
  })

  if (historyError) {
    console.warn('[refreshInstagramAccount] History error:', historyError)
  }

  await syncProfileAfterVerification(
    admin,
    userId,
    'instagram',
    `https://instagram.com/${user.username}`,
    user.profile_pic_url,
  )

  return {
    success: true,
    message: 'Hesap başarıyla güncellendi.',
    data: {
      username: user.username,
      platform_user_id: platformUserId,
      follower_count: followerCount,
      engagement_rate: engagementRate,
      ...statsPayload,
    },
  }
}

/**
 * TikTok hesabını doğrular (ilk sefer: biyografide kod aranır) veya
 * doğrulanmış hesabın istatistiklerini yeniler.
 */
export async function refreshTikTokAccount(userId: string, source: ScrapeSource = 'user'): Promise<SocialResult> {
  const admin = getAdminClient()

  const { account, error: fetchError, throttled } = await fetchScrapeAccount(admin, userId, 'tiktok')

  if (fetchError || !account) {
    return { success: false, error: 'Hesap bulunamadı.' }
  }

  return withScrapeSlot(admin, account, source, () => scrapeTikTok(admin, userId, account), throttled)
}

async function scrapeTikTok(admin: SupabaseClient, userId: string, account: ScrapeAccount): Promise<SocialResult> {
  let tiktokData
  try {
    tiktokData = await fetchTikTokPublicProfile(account.username)
  } catch (apiError: any) {
    console.error('[refreshTikTokAccount] TikTok service error:', apiError)
    return {
      success: false,
      code: isServiceOutage(apiError) ? 'service_unavailable' : 'scrape_failed',
      error: apiError.message || 'TikTok verileri çekilemedi. Lütfen daha sonra tekrar deneyin.',
    }
  }

  if (!account.is_verified && !bioContainsCode(tiktokData.signature, account.verification_code)) {
    return {
      success: false,
      error: `Doğrulama kodu (${account.verification_code}) TikTok biyografinizde bulunamadı. Lütfen kodu biyografinize eklediğinizden emin olun.`,
    }
  }

  const username = normalizeTikTokUsername(account.username)
  const followerCount = tiktokData.follower_count
  const totalLikes = tiktokData.likes_count

  // Açık veriden güvenilir etkileşim oranı çıkmadığı için yaklaşık bir değer, makul aralıkta tutulur.
  const engagementRate = followerCount > 0 ? parseFloat(((totalLikes / followerCount) * 10).toFixed(2)) : 4.8
  const boundedEngagement = Math.min(Math.max(engagementRate, 1.5), 18.5)

  const statsPayload = {
    total_likes: totalLikes,
    following_count: tiktokData.following_count,
    video_count: tiktokData.video_count,
    post_count: tiktokData.video_count,
    is_verified: true,
    avatar_url: tiktokData.avatar_url,
  }

  // Kalıcı TikTok kimliği varsa kullanılır (kullanıcı adı değişse de aynı hesap tanınır);
  // aynı hesabın başka bir kullanıcıya bağlanması engellenir.
  const platformUserId = tiktokData.platform_id ? `tt-id-${tiktokData.platform_id}` : `tt-${username}`
  const { data: idConflict } = await admin
    .from('social_accounts')
    .select('user_id')
    .eq('platform', 'tiktok')
    .eq('platform_user_id', platformUserId)
    .neq('user_id', userId)
    .maybeSingle()
  if (idConflict) {
    return { success: false, error: 'Bu TikTok hesabı sistemde zaten kayıtlı (başka bir kullanıcıda).' }
  }

  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .from('social_accounts')
    .update({
      username,
      is_verified: true,
      platform_user_id: platformUserId,
      follower_count: followerCount,
      engagement_rate: boundedEngagement,
      has_stats: true,
      stats_payload: statsPayload,
      last_scraped_at: now,
      updated_at: now,
    })
    .eq('id', account.id)

  if (updateError) {
    console.error('[refreshTikTokAccount] Update error:', updateError)
    return { success: false, error: 'Hesap güncellenemedi. Lütfen tekrar deneyin.' }
  }

  // Grafikler için geçmiş kaydı (Instagram ile aynı tablo). Ortalama gönderi verisi açık
  // profilden gelmediği için yalnızca takipçi ve yaklaşık etkileşim yazılır.
  const { error: historyError } = await admin.from('social_account_history').insert({
    social_account_id: account.id,
    follower_count: followerCount,
    engagement_rate: boundedEngagement,
    recorded_at: now,
  })
  if (historyError) {
    console.warn('[refreshTikTokAccount] History error:', historyError)
  }

  await syncProfileAfterVerification(admin, userId, 'tiktok', `https://tiktok.com/@${username}`, tiktokData.avatar_url)

  return {
    success: true,
    message: 'TikTok hesabınız başarıyla doğrulandı.',
    data: {
      username,
      follower_count: followerCount,
      engagement_rate: boundedEngagement,
      ...statsPayload,
    },
  }
}

/**
 * Doğrulanmış hesabın verisi 3 günden eskiyse yeniler. Doğrulanmamış hesaplar için
 * ücretli scraping çağrısı yapılmaz.
 */
export async function refreshIfStale(userId: string, platform: SocialPlatform) {
  const admin = getAdminClient()

  const { data: account } = await admin
    .from('social_accounts')
    .select('last_scraped_at, is_verified')
    .eq('user_id', userId)
    .eq('platform', platform)
    .maybeSingle()

  if (!account) return { status: 'no_account' as const }
  if (!account.is_verified) return { status: 'unverified' as const }

  const lastScraped = account.last_scraped_at ? new Date(account.last_scraped_at).getTime() : 0
  if (Date.now() - lastScraped < STALE_AFTER_MS) {
    return { status: 'fresh' as const }
  }

  return platform === 'tiktok' ? refreshTikTokAccount(userId, 'auto') : refreshInstagramAccount(userId, 'auto')
}

export interface StaleRefreshReport {
  attempted: number
  succeeded: number
  failed: number
  remaining: number // zaman bütçesi bittiği için bu turda yenilenmeyen bayat hesap sayısı
  stoppedEarly: boolean // art arda servis kesintisi (ör. Apify kredisi bitti) nedeniyle erken durdu
  deferred: number // hesaba özel hata (gizli/silinmiş hesap) nedeniyle bir süre kuyruktan çıkarılanlar
}

const RETRY_BACKOFF_DAYS = [1, 2, 4, 7]

/**
 * Verisi 3 günden eski doğrulanmış hesapları en eskiden başlayarak yeniler. Yeni bir ücretli koşuya
 * yalnızca `deadline` öncesinde başlanır; böylece cron fonksiyonu zaman aşımına düşmez ve iş
 * saatlik turlara yayılır. Art arda 2 servis kesintisi (kredi bitti vb.) alınırsa boşuna denemeden durur.
 * Hesaba özel hatada (gizli, silinmiş hesap) hesap 1/2/4/7 gün kuyruktan çıkarılır; kuyruğu tıkamaz.
 */
/** Otomatik yenilemede aynı anda çalışan Apify koşusu (fonksiyon süresi 60 sn). */
const REFRESH_CONCURRENCY = 3

export async function refreshStaleAccounts(
  admin: SupabaseClient,
  { deadline, limit = 25, concurrency = REFRESH_CONCURRENCY }: { deadline: number; limit?: number; concurrency?: number },
): Promise<StaleRefreshReport> {
  const nowIso = new Date().toISOString()
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString()
  const { data: accounts, error } = await admin
    .from('social_accounts')
    .select('id, user_id, platform, scrape_fail_count')
    .in('platform', ['instagram', 'tiktok'])
    .eq('is_verified', true)
    .or(`last_scraped_at.lt.${cutoff},last_scraped_at.is.null`)
    .or(`scrape_retry_after.is.null,scrape_retry_after.lt.${nowIso}`)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(`Bayat hesaplar alınamadı: ${error.message}`)

  const report: StaleRefreshReport = { attempted: 0, succeeded: 0, failed: 0, remaining: 0, stoppedEarly: false, deferred: 0 }
  let consecutiveOutages = 0
  let stop = false
  let next = 0
  const list = accounts ?? []

  // Bir Apify koşusu 20-45 sn sürer; sırayla gidildiğinde saatlik tur yalnızca 1 hesap
  // yenileyebiliyordu. Hesaplar REFRESH_CONCURRENCY kadar paralel işlenir; süre bütçesi
  // yalnızca yeni hesap başlatmayı durdurur, başlamış koşular tamamlanır.
  const processAccount = async (account: (typeof list)[number]) => {
    let result: SocialResult
    try {
      result =
        account.platform === 'tiktok'
          ? await refreshTikTokAccount(account.user_id, 'auto')
          : await refreshInstagramAccount(account.user_id, 'auto')
    } catch (refreshError) {
      console.error(`[refreshStaleAccounts] ${account.platform}/${account.user_id}:`, refreshError)
      result = { success: false, code: isServiceOutage(refreshError) ? 'service_unavailable' : 'scrape_failed' }
    }

    if (result.success || result.code === 'rate_limited') {
      // rate_limited: başka bir tur zaten bu hesabı yeniliyor
      report.succeeded++
      consecutiveOutages = 0
      if (result.success && account.scrape_fail_count) {
        await admin.from('social_accounts').update({ scrape_fail_count: 0, scrape_retry_after: null }).eq('id', account.id)
      }
      return
    }

    report.failed++
    if (result.code === 'service_unavailable') {
      if (++consecutiveOutages >= 2) {
        stop = true
        report.stoppedEarly = true
      }
      return
    }

    // Hesaba özel hata: hesabı artan sürelerle kuyruktan çıkar, sıradakine geç.
    consecutiveOutages = 0
    const failCount = (account.scrape_fail_count ?? 0) + 1
    const days = RETRY_BACKOFF_DAYS[Math.min(failCount, RETRY_BACKOFF_DAYS.length) - 1]
    const { error: deferError } = await admin
      .from('social_accounts')
      .update({ scrape_fail_count: failCount, scrape_retry_after: new Date(Date.now() + days * 86_400_000).toISOString() })
      .eq('id', account.id)
    if (deferError) console.error('[refreshStaleAccounts] Bekletme kaydedilemedi:', deferError.message)
    else report.deferred++
  }

  const worker = async () => {
    while (!stop && next < list.length && Date.now() < deadline) {
      const account = list[next++]
      report.attempted++
      await processAccount(account)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker))
  report.remaining = list.length - next
  return report
}

