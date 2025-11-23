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

  // Validate username format and uniqueness if username is provided
  if (payload.username && payload.username.trim()) {
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
  const normalizedUsername = payload.username?.trim() || null
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

