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

  // Send Welcome Message
  try {
    const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
    const supabaseAdmin = createSupabaseAdminClient()
    if (supabaseAdmin) {
      await sendWelcomeMessage(supabaseAdmin, payload.userId, payload.fullName)
    } else {
      console.warn('[saveOnboardingProfile] Admin client not available for welcome message')
    }
  } catch (msgError) {
    console.error('[saveOnboardingProfile] Failed to send welcome message:', msgError)
  }

  revalidatePath('/dashboard')
  revalidatePath('/onboarding')

  return { success: true, data }
}

async function sendWelcomeMessage(supabase: any, userId: string, userName: string) {
  // 1. Find Admin User to send message from
  const { data: adminUser } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (!adminUser) {
    console.warn('No admin user found to send welcome message.')
    return
  }

  const adminId = adminUser.id

  // 2. Check if a room already exists between admin and user
  // First get rooms for user
  const { data: userRooms } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', userId)

  let roomId = null

  if (userRooms && userRooms.length > 0) {
    const roomIds = userRooms.map((r: any) => r.room_id)
    // Check if admin is in any of these rooms
    const { data: commonRoom } = await supabase
      .from('room_participants')
      .select('room_id')
      .eq('user_id', adminId)
      .in('room_id', roomIds)
      .limit(1)
      .maybeSingle()

    if (commonRoom) {
      roomId = commonRoom.room_id
    }
  }

  // 3. Create room if it doesn't exist
  if (!roomId) {
    const { data: newRoom, error: roomError } = await supabase
      .from('rooms')
      .insert({ created_by: adminId })
      .select()
      .single()

    if (roomError || !newRoom) {
      console.error('Failed to create welcome room:', roomError)
      return
    }
    roomId = newRoom.id

    // Add participants
    const { error: participantError } = await supabase.from('room_participants').insert([
      { room_id: roomId, user_id: adminId },
      { room_id: roomId, user_id: userId }
    ])

    if (participantError) {
      console.error('Failed to add participants to welcome room:', participantError)
      return
    }
  }

  // 4. Send Message
  const messageContent = `Merhaba ${userName}, Influmatch'e hoş geldin! 🎉\n\nMarkalar ve influencerlar arasında köprü kurarak işbirliklerini kolaylaştıran platformumuzda seni görmek harika.\n\nProfilini eksiksiz doldurman, rozetler kazanmanı ve daha fazla etkileşim almanı sağlayacaktır. Herhangi bir sorunda veya desteğe ihtiyacın olduğunda bu sohbet üzerinden bize ulaşabilirsin.\n\nBaşarılar dileriz!`

  await supabase.from('messages').insert({
    room_id: roomId,
    sender_id: adminId,
    content: messageContent,
    read: false
  })
}
