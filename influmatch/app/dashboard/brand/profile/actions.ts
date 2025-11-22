'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { validateInstagram, validateLinkedIn, validateWebsite } from '@/utils/socialLinkValidation'
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
  displayedBadges?: string[]
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
  const websiteResult = validateWebsite(payload.website)
  const linkedinResult = validateLinkedIn(payload.linkedin)
  const instagramResult = validateInstagram(payload.instagram)

  if (!websiteResult.isValid) {
    throw new Error(websiteResult.error || 'Geçersiz web sitesi linki.')
  }
  if (!linkedinResult.isValid) {
    throw new Error(linkedinResult.error || 'Geçersiz LinkedIn linki.')
  }
  if (!instagramResult.isValid) {
    throw new Error(instagramResult.error || 'Geçersiz Instagram linki.')
  }

  const updates: any = {
    full_name: payload.brandName.trim(),
    username: payload.username.trim() || null,
    city: payload.city.trim() || null,
    bio: payload.bio.trim() || null,
    category: payload.category || null,
    avatar_url: payload.logoUrl,
    social_links: {
      website: websiteResult.normalizedUrl || null,
      linkedin: linkedinResult.normalizedUrl || null,
      instagram: instagramResult.normalizedUrl || null,
    },
  }

  // Update displayed_badges if provided
  if (payload.displayedBadges !== undefined) {
    updates.displayed_badges = payload.displayedBadges
  }

  const { error: upsertError } = await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role ?? 'brand',
        ...updates,
      },
      { onConflict: 'id' },
    )

  if (upsertError) {
    // Check if it's a unique constraint violation for username
    if (upsertError.code === '23505' || upsertError.message.includes('unique') || upsertError.message.includes('duplicate')) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }
    
    // Check if it's a column not found error for displayed_badges
    if (upsertError.message.includes('displayed_badges') || upsertError.message.includes('schema cache')) {
      console.error('[updateBrandProfile] displayed_badges column error:', upsertError.message)
      // Remove displayed_badges from updates and try again
      delete updates.displayed_badges
      const { error: retryError } = await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email,
            role: user.user_metadata?.role ?? 'brand',
            ...updates,
          },
          { onConflict: 'id' },
        )
      
      if (retryError) {
        throw new Error(retryError.message)
      }
      
      // Log warning about displayed_badges column
      console.warn('[updateBrandProfile] displayed_badges column not found, profile updated without badges. Please run migration: add_displayed_badges_column.sql')
    } else {
      throw new Error(upsertError.message)
    }
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


