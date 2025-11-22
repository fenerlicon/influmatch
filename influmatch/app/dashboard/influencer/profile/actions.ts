'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { validateInstagram, validateTikTok, validateYouTube } from '@/utils/socialLinkValidation'
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

  if (!instagramResult.isValid) {
    throw new Error(instagramResult.error || 'Geçersiz Instagram linki.')
  }
  if (!tiktokResult.isValid) {
    throw new Error(tiktokResult.error || 'Geçersiz TikTok linki.')
  }
  if (!youtubeResult.isValid) {
    throw new Error(youtubeResult.error || 'Geçersiz YouTube linki.')
  }

  const updates: any = {
    full_name: payload.fullName || null,
    username: payload.username || null,
    city: payload.city || null,
    bio: payload.bio || null,
    category: payload.category || null,
    avatar_url: payload.avatarUrl,
    social_links: {
      instagram: instagramResult.normalizedUrl || null,
      tiktok: tiktokResult.normalizedUrl || null,
      youtube: youtubeResult.normalizedUrl || null,
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
        role: user.user_metadata?.role ?? 'influencer',
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
      console.error('[updateProfile] displayed_badges column error:', upsertError.message)
      // Remove displayed_badges from updates and try again
      delete updates.displayed_badges
      const { error: retryError } = await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email,
            role: user.user_metadata?.role ?? 'influencer',
            ...updates,
          },
          { onConflict: 'id' },
        )
      
      if (retryError) {
        throw new Error(retryError.message)
      }
      
      // Log warning about displayed_badges column
      console.warn('[updateProfile] displayed_badges column not found, profile updated without badges. Please run migration: add_displayed_badges_column.sql')
    } else {
      throw new Error(upsertError.message)
    }
  }

  // Award badges after profile update
  await awardBadgesForUser(user.id)

  revalidatePath('/dashboard/influencer/profile')
  revalidatePath('/dashboard/brand/profile')
  revalidatePath('/dashboard/brand/discover')
  revalidatePath(`/profile/${payload.username}`)
  revalidatePath(`/dashboard/influencer/badges`)
  if (payload.previousUsername && payload.previousUsername !== payload.username) {
    revalidatePath(`/profile/${payload.previousUsername}`)
  }

  return { success: true }
}

