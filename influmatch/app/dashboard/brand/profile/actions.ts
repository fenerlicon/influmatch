'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { validateInstagram, validateLinkedIn, validateWebsite, validateKick, validateTwitter, validateTwitch } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import { awardBadgesForUser } from '@/utils/badgeAwarding'

interface UpdateBrandProfilePayload {
  brandName: string
  username: string
  city: string
  bio: string
  category: string
  logoUrl: string | null
  website: string
  linkedin: string
  instagram: string
  kick?: string | null
  twitter?: string | null
  twitch?: string | null
  displayedBadges?: string[]
  companyLegalName?: string | null
  taxId?: string | null
}

export async function updateBrandProfile(payload: UpdateBrandProfilePayload) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yapın.')
  }

  if (!payload.brandName.trim()) {
    throw new Error('Marka adı gereklidir.')
  }

  // Get current user's data from database
  const { data: currentUser } = await supabase
    .from('users')
    .select('username, social_links, social_links_last_updated')
    .eq('id', user.id)
    .maybeSingle()

  const currentUsername = currentUser?.username
  const currentSocialLinks = (currentUser?.social_links as Record<string, string | null>) || {}
  const socialLinksLastUpdated = currentUser?.social_links_last_updated

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
    website: payload.website?.trim() || null,
    linkedin: payload.linkedin?.trim() || null,
    instagram: payload.instagram?.trim() || null,
    kick: payload.kick?.trim() || null,
    twitter: payload.twitter?.trim() || null,
    twitch: payload.twitch?.trim() || null,
  }

  // Normalize current social links for comparison
  const normalizedCurrentSocialLinks = {
    website: currentSocialLinks.website?.trim() || null,
    linkedin: currentSocialLinks.linkedin?.trim() || null,
    instagram: currentSocialLinks.instagram?.trim() || null,
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
  const websiteResult = validateWebsite(payload.website)
  const linkedinResult = validateLinkedIn(payload.linkedin)
  const instagramResult = validateInstagram(payload.instagram)
  const kickResult = validateKick(payload.kick)
  const twitterResult = validateTwitter(payload.twitter)
  const twitchResult = validateTwitch(payload.twitch)

  if (!websiteResult.isValid) {
    throw new Error(websiteResult.error || 'Geçersiz web sitesi linki.')
  }
  if (!linkedinResult.isValid) {
    throw new Error(linkedinResult.error || 'Geçersiz LinkedIn linki.')
  }
  if (!instagramResult.isValid) {
    throw new Error(instagramResult.error || 'Geçersiz Instagram linki.')
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
  const normalizedBrandName = payload.brandName?.trim() || null

  const updates: any = {
    full_name: normalizedBrandName,
    username: normalizedUsername,
    city: normalizedCity,
    bio: normalizedBio,
    category: payload.category || null,
    avatar_url: payload.logoUrl,
    company_legal_name: payload.companyLegalName?.trim() || null,
    tax_id: payload.taxId?.trim() || null,
    social_links: {
      website: websiteResult.normalizedUrl || null,
      linkedin: linkedinResult.normalizedUrl || null,
      instagram: instagramResult.normalizedUrl || null,
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

  console.log('[updateBrandProfile] Attempting update for user:', user.id)
  console.log('[updateBrandProfile] Updates:', JSON.stringify(updates, null, 2))

  const { data: updateResult, error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()

  if (updateError) {
    console.error('[updateBrandProfile] Update error:', updateError)
    // Check if it's a unique constraint violation for username
    if (updateError.code === '23505' || updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }
    
    // Check if it's a column not found error for displayed_badges
    if (updateError.message.includes('displayed_badges') || updateError.message.includes('schema cache')) {
      console.error('[updateBrandProfile] displayed_badges column error:', updateError.message)
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
      console.warn('[updateBrandProfile] displayed_badges column not found, profile updated without badges. Please run migration: add_displayed_badges_column.sql')
    } else {
      console.error('[updateBrandProfile] Update failed with error:', updateError)
      throw new Error(updateError.message)
    }
  }

  // Log update result
  if (updateResult && updateResult.length > 0) {
    console.log('[updateBrandProfile] Update successful, returned data:', JSON.stringify(updateResult[0], null, 2))
  } else {
    console.warn('[updateBrandProfile] Update completed but no data returned (this is normal for UPDATE operations)')
  }

  // Award badges after profile update
  await awardBadgesForUser(user.id)

  revalidatePath('/dashboard/brand/profile')
  revalidatePath('/dashboard/brand')
  revalidatePath('/dashboard/brand/advert')
  revalidatePath('/dashboard/brand/discover')
  revalidatePath(`/dashboard/brand/badges`)

  return { success: true }
}


