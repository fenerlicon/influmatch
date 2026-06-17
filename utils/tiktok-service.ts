
import { createSupabaseAdminClient } from './supabase/admin'

/**
 * TikTok Service for handling OAuth and Data Fetching via TikTok for Developers (API v2)
 */

export interface TikTokUser {
  open_id: string
  union_id?: string
  avatar_url: string
  display_name: string
  follower_count?: number
  following_count?: number
  likes_count?: number
  video_count?: number
}

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net'}/api/auth/tiktok/callback`

/**
 * Generates the TikTok OAuth URL to redirect the user
 */
export function getTikTokAuthUrl(state: string) {
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.searchParams.append('client_key', TIKTOK_CLIENT_KEY || '')
  url.searchParams.append('scope', 'user.info.basic,user.stats,video.list')
  url.searchParams.append('response_type', 'code')
  url.searchParams.append('redirect_uri', REDIRECT_URI)
  url.searchParams.append('state', state)
  return url.toString()
}

/**
 * Exchanges the authorization code for an access token
 */
export async function getTikTokTokens(code: string) {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY || '',
      client_secret: TIKTOK_CLIENT_SECRET || '',
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('[TikTokService] Token Exchange Error:', error)
    throw new Error(error.error_description || 'TikTok token değişimi başarısız oldu.')
  }

  return response.json()
}

/**
 * Fetches user profile information and statistics
 */
export async function getTikTokUserProfile(accessToken: string): Promise<TikTokUser> {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.json()
    console.error('[TikTokService] Profile Fetch Error:', error)
    throw new Error('TikTok profil bilgileri alınamadı.')
  }

  const result = await response.json()
  const user = result.data?.user

  if (!user) {
    throw new Error('TikTok API yanıtında kullanıcı verisi bulunamadı.')
  }

  return user
}

/**
 * Saves TikTok account data to our database (Supabase)
 */
export async function saveTikTokAccount(userId: string, tiktokData: TikTokUser, tokens: any) {
  const adminSupabase = createSupabaseAdminClient()
  if (!adminSupabase) throw new Error('Database connection failure.')

  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error } = await adminSupabase.from('social_accounts').upsert(
    {
      user_id: userId,
      platform: 'tiktok',
      username: tiktokData.display_name, // TikTok often doesn't give the @handle in basic scope easily
      platform_user_id: tiktokData.open_id,
      profile_url: `https://www.tiktok.com/@${tiktokData.display_name}`, // Fallback
      follower_count: tiktokData.follower_count || 0,
      following_count: tiktokData.following_count || 0,
      media_count: tiktokData.video_count || 0,
      is_verified: true,
      verified_at: now,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      stats_payload: {
        total_likes: tiktokData.likes_count || 0,
        avatar_url: tiktokData.avatar_url,
      },
      updated_at: now,
    },
    { onConflict: 'user_id, platform' }
  )

  if (error) {
    console.error('[TikTokService] DB Update Error:', error)
    throw new Error(`Veritabanı güncelleme hatası: ${error.message}`)
  }

  return { success: true }
}

export interface NormalizedTikTokData {
  username: string
  display_name: string
  follower_count: number
  following_count: number
  likes_count: number
  video_count: number
  avatar_url: string | null
  signature: string
}

async function withRetry<T>(fn: () => Promise<T>, retries: number, delay: number = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`[TikTokService] Retrying operation... Attempts left: ${retries}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 1.5);
  }
}

export async function fetchTikTokPublicProfile(username: string): Promise<NormalizedTikTokData> {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN eksik. Lütfen sistem yöneticisi ile görüşün.');
  }

  try {
    console.log(`[TikTokService] Fetching TikTok data for ${username} via Apify...`);
    return await withRetry(() => fetchTikTokFromApify(username), 2);
  } catch (error: any) {
    console.error(`[TikTokService] Apify fetch failed: ${error.message || error}`);
    const msg = error.message || 'Apify servis hatası';
    throw new Error(msg.includes('TikTok') ? msg : `TikTok verileri alınamadı: ${msg}`);
  }
}

async function fetchTikTokFromApify(username: string): Promise<NormalizedTikTokData> {
  const token = process.env.APIFY_API_TOKEN;
  const cleanUsername = username.replace('@', '').trim();

  // Call official Clockworks TikTok Profile Scraper
  const response = await fetch(`https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?token=${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "profiles": [cleanUsername],
      "resultsPerPage": 1
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error('Apify API Token geçersiz.');
    if (response.status === 402) throw new Error('Apify bakiye yetersiz.');
    throw new Error(`Apify HTTP ${response.status}: ${errorText}`);
  }

  const items = await response.json();
  if (!items || items.length === 0) {
    throw new Error('TikTok profil verisi bulunamadı. Kullanıcı adı hatalı olabilir veya hesap gizli olabilir.');
  }

  const profile = items[0];

  // Support both clockworks/tiktok-profile-scraper flat structure and nested authorMeta structures
  const authorMeta = profile.authorMeta || {};
  const followerCount = Number(
    profile.followerCount ??
    profile.followers ?? 
    profile.followersCount ?? 
    authorMeta.fans ?? 
    authorMeta.followerCount ?? 
    0
  );
  const followingCount = Number(
    profile.followingCount ?? 
    profile.following ?? 
    authorMeta.following ?? 
    authorMeta.followingCount ?? 
    0
  );
  const likesCount = Number(
    profile.heartCount ?? 
    profile.likes ?? 
    profile.hearts ?? 
    authorMeta.heart ?? 
    authorMeta.heartCount ?? 
    0
  );
  const videoCount = Number(
    profile.videoCount ?? 
    profile.videos ?? 
    profile.video ?? 
    authorMeta.video ?? 
    authorMeta.videoCount ?? 
    0
  );
  const avatarUrl = 
    profile.avatarLarger ?? 
    profile.avatar ?? 
    profile.avatarUrl ?? 
    authorMeta.avatar ?? 
    null;
  const signature = 
    profile.signature ?? 
    profile.bio ?? 
    authorMeta.signature ?? 
    '';
  const displayName = 
    profile.nickname ?? 
    profile.displayName ?? 
    authorMeta.nickName ?? 
    authorMeta.nickname ?? 
    cleanUsername;

  return {
    username: cleanUsername,
    display_name: displayName,
    follower_count: followerCount,
    following_count: followingCount,
    likes_count: likesCount,
    video_count: videoCount,
    avatar_url: avatarUrl,
    signature: signature
  };
}
