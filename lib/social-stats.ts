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
export async function refreshInstagramAccount(userId: string): Promise<SocialResult> {
  const admin = getAdminClient()

  const { data: account, error: fetchError } = await admin
    .from('social_accounts')
    .select('id, username, verification_code, is_verified')
    .eq('user_id', userId)
    .eq('platform', 'instagram')
    .maybeSingle()

  if (fetchError || !account) {
    return { success: false, error: 'Hesap bulunamadı.' }
  }

  let normalizedData
  try {
    normalizedData = await fetchInstagramData(account.username)
  } catch (apiError: any) {
    console.error('[refreshInstagramAccount] Instagram service error:', apiError)
    return { success: false, error: apiError.message || 'Instagram verileri çekilemedi. Lütfen daha sonra tekrar deneyin.' }
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
export async function refreshTikTokAccount(userId: string): Promise<SocialResult> {
  const admin = getAdminClient()

  const { data: account, error: fetchError } = await admin
    .from('social_accounts')
    .select('id, username, verification_code, is_verified')
    .eq('user_id', userId)
    .eq('platform', 'tiktok')
    .maybeSingle()

  if (fetchError || !account) {
    return { success: false, error: 'Hesap bulunamadı.' }
  }

  let tiktokData
  try {
    tiktokData = await fetchTikTokPublicProfile(account.username)
  } catch (apiError: any) {
    console.error('[refreshTikTokAccount] TikTok service error:', apiError)
    return { success: false, error: apiError.message || 'TikTok verileri çekilemedi. Lütfen daha sonra tekrar deneyin.' }
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

  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .from('social_accounts')
    .update({
      username,
      is_verified: true,
      platform_user_id: `tt-${username}`,
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

  return platform === 'tiktok' ? refreshTikTokAccount(userId) : refreshInstagramAccount(userId)
}
