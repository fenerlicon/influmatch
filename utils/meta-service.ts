
import { createSupabaseAdminClient } from './supabase/admin'

/**
 * Meta/Instagram Service for handling OAuth and Data Fetching via Instagram Graph API
 */

export interface InstagramMetaUser {
  id: string; // Instagram Business Account ID
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  biography?: string;
  website?: string;
}

const CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID
const CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net'}/api/auth/instagram/callback`

/**
 * Generates the Meta OAuth URL (Facebook Login)
 * Users must have a Facebook account linked to an Instagram Business/Creator account.
 */
export function getInstagramAuthUrl(state: string) {
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  url.searchParams.append('client_id', CLIENT_ID || '')
  url.searchParams.append('redirect_uri', REDIRECT_URI)
  url.searchParams.append('state', state)
  // Essential permissions for Instagram Graph API
  url.searchParams.append('scope', 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement,public_profile')
  url.searchParams.append('response_type', 'code')
  return url.toString()
}

/**
 * Exchanges the authorization code for an access token
 */
export async function getMetaTokens(code: string) {
  const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
  url.searchParams.append('client_id', CLIENT_ID || '')
  url.searchParams.append('client_secret', CLIENT_SECRET || '')
  url.searchParams.append('redirect_uri', REDIRECT_URI)
  url.searchParams.append('code', code)

  const response = await fetch(url.toString())

  if (!response.ok) {
    const error = await response.json()
    console.error('[MetaService] Token Exchange Error:', error)
    throw new Error(error.error?.message || 'Meta token değişimi başarısız oldu.')
  }

  return response.json()
}

/**
 * Fetches the Instagram Business Account linked to the user's Facebook Pages
 */
export async function getInstagramBusinessAccount(accessToken: string): Promise<InstagramMetaUser> {
  // 1. Get the list of Pages managed by the user
  const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`)
  
  if (!pagesResponse.ok) {
    throw new Error('Facebook sayfaları alınamadı.')
  }
  
  const pagesData = await pagesResponse.json()
  const pages = pagesData.data || []
  
  if (pages.length === 0) {
    throw new Error('Bağlı herhangi bir Facebook sayfası bulunamadı. Instagram hesabınızın bir Sayfaya bağlı olduğundan emin olun.')
  }

  // 2. Find the first page that has a linked Instagram Business Account
  for (const page of pages) {
    const igResponse = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`)
    const igData = await igResponse.json()
    
    if (igData.instagram_business_account) {
      const igId = igData.instagram_business_account.id
      
      // 3. Fetch details for this Instagram account
      const detailsResponse = await fetch(
        `https://graph.facebook.com/v19.0/${igId}?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${accessToken}`
      )
      
      if (detailsResponse.ok) {
        return await detailsResponse.json()
      }
    }
  }

  throw new Error('Facebook sayfanıza bağlı bir Instagram Business/Creator hesabı bulunamadı.')
}

/**
 * Saves or updates Instagram account data in our database
 */
export async function saveInstagramMetaAccount(userId: string, igData: InstagramMetaUser, tokens: any) {
  const adminSupabase = createSupabaseAdminClient()
  if (!adminSupabase) throw new Error('Database connection failure.')

  const now = new Date().toISOString()
  const expiresAt = tokens.expires_in 
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  const { error } = await adminSupabase.from('social_accounts').upsert(
    {
      user_id: userId,
      platform: 'instagram',
      username: igData.username,
      platform_user_id: igData.id,
      profile_url: `https://www.instagram.com/${igData.username}`,
      follower_count: igData.followers_count || 0,
      following_count: igData.follows_count || 0,
      media_count: igData.media_count || 0,
      is_verified: true,
      verified_at: now,
      access_token: tokens.access_token,
      token_expires_at: expiresAt,
      stats_payload: {
        full_name: igData.name,
        biography: igData.biography,
        avatar_url: igData.profile_picture_url,
        website: igData.website,
        verified_via: 'meta_api'
      },
      updated_at: now,
      has_stats: true, // Mark as having stats since we pulled followers etc.
    },
    { onConflict: 'user_id, platform' }
  )

  if (error) {
    console.error('[MetaService] DB Update Error:', error)
    throw new Error(`Veritabanı güncelleme hatası: ${error.message}`)
  }

  // Award "Verified Account" Badge
  await adminSupabase.from('user_badges').upsert(
    {
      user_id: userId,
      badge_id: 'verified-account',
      earned_at: now
    },
    { onConflict: 'user_id, badge_id' }
  )

  return { success: true }
}
