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

  // First check if profile exists
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id')
    .eq('id', payload.userId)
    .maybeSingle()

  let data, error

  if (existingProfile) {
    // Profile exists - use UPDATE
    console.log('[saveOnboardingProfile] Profile exists, using UPDATE')
    const updateResult = await supabase
      .from('users')
      .update({
        email: user.email || '',
        role: payload.role,
        full_name: payload.fullName,
        username: payload.username,
        city: payload.city,
        bio: payload.bio,
        category: payload.category,
        avatar_url: payload.avatarUrl,
        social_links: payload.socialLinks,
      })
      .eq('id', payload.userId)
      .select()
    
    data = updateResult.data
    error = updateResult.error
  } else {
    // Profile doesn't exist - use INSERT
    console.log('[saveOnboardingProfile] Profile does not exist, using INSERT')
    const insertResult = await supabase
      .from('users')
      .insert({
        id: payload.userId,
        email: user.email || '',
        role: payload.role,
        full_name: payload.fullName,
        username: payload.username,
        city: payload.city,
        bio: payload.bio,
        category: payload.category,
        avatar_url: payload.avatarUrl,
        social_links: payload.socialLinks,
      })
      .select()
    
    data = insertResult.data
    error = insertResult.error
  }

  if (error) {
    console.error('[saveOnboardingProfile] Save error:', error)
    console.error('[saveOnboardingProfile] Error code:', error.code)
    console.error('[saveOnboardingProfile] Error message:', error.message)
    console.error('[saveOnboardingProfile] Error details:', error.details)
    console.error('[saveOnboardingProfile] Error hint:', error.hint)
    
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

  revalidatePath('/dashboard')
  revalidatePath('/onboarding')

  return { success: true, data }
}
