'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

interface SaveOnboardingPayload {
  userId: string
  role: 'influencer' | 'brand'
  fullName: string
  username: string
  city: string
  bio: string
  category: string
  avatarUrl: string | null
  taxId?: string | null
  socialLinks: {
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    website?: string | null
    linkedin?: string | null
    kick?: string | null
    twitter?: string | null
    twitch?: string | null
  }
}

import { awardBadgesForUser } from '@/utils/badgeAwarding'

export async function saveOnboardingProfile(payload: SaveOnboardingPayload) {
  const supabase = createSupabaseServerClient()

  // Verify user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== payload.userId) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  console.log('[saveOnboardingProfile] Attempting to save profile:', payload)

  // Normalize data
  const normalizedUsername = payload.username?.trim() || null
  const normalizedCity = payload.city?.trim() || null
  const normalizedBio = payload.bio?.trim() || null
  const normalizedFullName = payload.fullName?.trim() || null

  // Use UPSERT to handle both insert and update in one go
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: payload.userId,
      email: user.email || '',
      role: payload.role,
      full_name: normalizedFullName,
      username: normalizedUsername,
      city: normalizedCity,
      bio: normalizedBio,
      category: payload.category || null,
      avatar_url: payload.avatarUrl,
      tax_id: payload.taxId?.trim() || null,
      social_links: payload.socialLinks,
    })
    .select()
    .single()

  if (error) {
    console.error('[saveOnboardingProfile] Save error:', error)

    // Check if it's a unique constraint violation
    if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
      return { success: false, error: 'Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.' }
    } else if (error.message.includes('row-level security') || error.code === '42501') {
      return { success: false, error: `RLS hatası: ${error.message}. Lütfen Supabase'de RLS politikalarını kontrol edin.` }
    } else {
      return { success: false, error: `Profil kaydedilemedi: ${error.message || 'Bilinmeyen hata'}` }
    }
  }

  console.log('[saveOnboardingProfile] Profile saved successfully:', data)

  // Award badges directly on server side (no extra HTTP request needed)
  try {
    await awardBadgesForUser(payload.userId)
  } catch (badgeError) {
    console.error('[saveOnboardingProfile] Failed to award badges:', badgeError)
    // Don't fail the whole request if badge awarding fails
  }

  revalidatePath('/dashboard')
  revalidatePath('/onboarding')

  return { success: true, data }
}
