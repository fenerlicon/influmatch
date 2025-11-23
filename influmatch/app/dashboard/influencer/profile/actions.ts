'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { validateInstagram, validateTikTok, validateYouTube, validateKick, validateTwitter, validateTwitch } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import { awardBadgesForUser } from '@/utils/badgeAwarding'

interface UpdateProfilePayload {
  fullName: string
  username: string
  previousUsername: string
  city: string
  bio: string
  category: string
  avatarUrl: string | null
  socialLinks: {
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    kick?: string | null
    twitter?: string | null
    twitch?: string | null
  }
  displayedBadges?: string[]
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yapın.')
  }

  // Get current user's data from database
  // Try to select social_links_last_updated, but handle gracefully if column doesn't exist yet
  let currentUser: any = null
  let currentUserError: any = null
  
  try {
    const result = await supabase
      .from('users')
      .select('username, social_links, social_links_last_updated')
      .eq('id', user.id)
      .maybeSingle()
    currentUser = result.data
    currentUserError = result.error
  } catch (err: any) {
    // If column doesn't exist, try without it
    if (err.message?.includes('social_links_last_updated') || err.message?.includes('column')) {
      const result = await supabase
        .from('users')
        .select('username, social_links')
        .eq('id', user.id)
        .maybeSingle()
      currentUser = result.data
      currentUserError = result.error
    } else {
      throw err
    }
  }

  if (currentUserError) {
    console.error('[updateProfile] Error fetching current user:', currentUserError)
    throw new Error('Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.')
  }

  if (!currentUser) {
    throw new Error('Kullanıcı bulunamadı.')
  }

  const currentUsername = currentUser?.username
  const currentSocialLinks = (currentUser?.social_links as Record<string, string | null>) || {}
  const socialLinksLastUpdated = currentUser?.social_links_last_updated || null

  // If user already has a username, prevent changing it
  if (currentUsername && payload.username && payload.username.trim()) {
    const trimmedNewUsername = payload.username.trim().toLowerCase()
    const trimmedCurrentUsername = currentUsername.trim().toLowerCase()
    
    // If trying to change username, reject it
    if (trimmedNewUsername !== trimmedCurrentUsername) {
      throw new Error('Kullanıcı adı bir kez belirlendikten sonra değiştirilemez.')
    }
  }

  // Validate username format and uniqueness if username is provided and user doesn't have one yet
  if (payload.username && payload.username.trim() && !currentUsername) {
    const trimmedUsername = payload.username.trim().toLowerCase()
    
    // Validate format (Instagram rules)
    const usernameValidation = validateUsername(trimmedUsername)
    if (!usernameValidation.isValid) {
      throw new Error(usernameValidation.error || 'Kullanıcı adı geçersiz.')
    }

    const normalizedUsername = usernameValidation.normalized || trimmedUsername

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .neq('id', user.id)
      .maybeSingle()

    if (existingUser) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }

    // Use normalized username
    payload.username = normalizedUsername
  } else if (currentUsername) {
    // Keep existing username if user already has one
    payload.username = currentUsername
  }

  // Check if social links have changed
  const newSocialLinks = {
    instagram: payload.socialLinks.instagram?.trim() || null,
    tiktok: payload.socialLinks.tiktok?.trim() || null,
    youtube: payload.socialLinks.youtube?.trim() || null,
    kick: payload.socialLinks.kick?.trim() || null,
    twitter: payload.socialLinks.twitter?.trim() || null,
    twitch: payload.socialLinks.twitch?.trim() || null,
  }

  // Normalize current social links for comparison
  const normalizedCurrentSocialLinks = {
    instagram: currentSocialLinks.instagram?.trim() || null,
    tiktok: currentSocialLinks.tiktok?.trim() || null,
    youtube: currentSocialLinks.youtube?.trim() || null,
    kick: currentSocialLinks.kick?.trim() || null,
    twitter: currentSocialLinks.twitter?.trim() || null,
    twitch: currentSocialLinks.twitch?.trim() || null,
  }

  // Check if any social link has changed
  const socialLinksChanged = JSON.stringify(newSocialLinks) !== JSON.stringify(normalizedCurrentSocialLinks)

  // If social links changed, check if 30 days have passed since last update
  if (socialLinksChanged && socialLinksLastUpdated) {
    const lastUpdated = new Date(socialLinksLastUpdated)
    const now = new Date()
    const daysSinceLastUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceLastUpdate < 30) {
      const daysRemaining = 30 - daysSinceLastUpdate
      throw new Error(`Sosyal medya hesaplarınızı 30 günde sadece 1 kez değiştirebilirsiniz. ${daysRemaining} gün sonra tekrar değiştirebilirsiniz.`)
    }
  }

  // Validate social links
  const instagramResult = validateInstagram(payload.socialLinks.instagram)
  const tiktokResult = validateTikTok(payload.socialLinks.tiktok)
  const youtubeResult = validateYouTube(payload.socialLinks.youtube)
  const kickResult = validateKick(payload.socialLinks.kick)
  const twitterResult = validateTwitter(payload.socialLinks.twitter)
  const twitchResult = validateTwitch(payload.socialLinks.twitch)

  if (!instagramResult.isValid) {
    throw new Error(instagramResult.error || 'Geçersiz Instagram linki.')
  }
  if (!tiktokResult.isValid) {
    throw new Error(tiktokResult.error || 'Geçersiz TikTok linki.')
  }
  if (!youtubeResult.isValid) {
    throw new Error(youtubeResult.error || 'Geçersiz YouTube linki.')
  }
  if (!kickResult.isValid) {
    throw new Error(kickResult.error || 'Geçersiz Kick linki.')
  }
  if (!twitterResult.isValid) {
    throw new Error(twitterResult.error || 'Geçersiz Twitter/X linki.')
  }
  if (!twitchResult.isValid) {
    throw new Error(twitchResult.error || 'Geçersiz Twitch linki.')
  }

  // Normalize values: empty strings become null to satisfy constraints
  // Ensure username is set (either from payload or keep existing)
  const finalUsername = payload.username?.trim() || currentUsername || null
  const normalizedUsername = finalUsername
  const normalizedCity = payload.city?.trim() || null
  const normalizedBio = payload.bio?.trim() || null
  const normalizedFullName = payload.fullName?.trim() || null

  const updates: any = {
    full_name: normalizedFullName,
    username: normalizedUsername,
    city: normalizedCity,
    bio: normalizedBio,
    category: payload.category || null,
    avatar_url: payload.avatarUrl,
    social_links: {
      instagram: instagramResult.normalizedUrl || null,
      tiktok: tiktokResult.normalizedUrl || null,
      youtube: youtubeResult.normalizedUrl || null,
      kick: kickResult.normalizedUrl || null,
      twitter: twitterResult.normalizedUrl || null,
      twitch: twitchResult.normalizedUrl || null,
    },
  }

  // Update social_links_last_updated if social links changed
  if (socialLinksChanged) {
    updates.social_links_last_updated = new Date().toISOString()
  }

  // Update displayed_badges if provided
  if (payload.displayedBadges !== undefined) {
    updates.displayed_badges = payload.displayedBadges
  }

  console.log('[updateProfile] Attempting update for user:', user.id)
  console.log('[updateProfile] Updates:', JSON.stringify(updates, null, 2))

  const { data: updateResult, error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()

  if (updateError) {
    console.error('[updateProfile] Update error:', updateError)
    // Check if it's a unique constraint violation for username
    if (updateError.code === '23505' || updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }
    
    // Check if it's a column not found error for displayed_badges
    if (updateError.message.includes('displayed_badges') || updateError.message.includes('schema cache')) {
      console.error('[updateProfile] displayed_badges column error:', updateError.message)
      // Remove displayed_badges from updates and try again
      delete updates.displayed_badges
      const { error: retryError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
      
      if (retryError) {
        throw new Error(retryError.message)
      }
      
      // Log warning about displayed_badges column
      console.warn('[updateProfile] displayed_badges column not found, profile updated without badges. Please run migration: add_displayed_badges_column.sql')
    } else {
      console.error('[updateProfile] Update failed with error:', updateError)
      throw new Error(updateError.message)
    }
  }

  // Log update result
  if (updateResult && updateResult.length > 0) {
    console.log('[updateProfile] Update successful, returned data:', JSON.stringify(updateResult[0], null, 2))
  } else {
    console.warn('[updateProfile] Update completed but no data returned (this is normal for UPDATE operations)')
  }

  // Award badges after profile update
  await awardBadgesForUser(user.id)

  revalidatePath('/dashboard/influencer/profile')
  revalidatePath('/dashboard/influencer/discover')
  revalidatePath(`/profile/${payload.username}`)
  revalidatePath(`/dashboard/influencer/badges`)
  if (payload.previousUsername && payload.previousUsername !== payload.username) {
    revalidatePath(`/profile/${payload.previousUsername}`)
  }

  return { success: true }
}

