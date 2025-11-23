'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export type AdvertStatus = 'open' | 'paused' | 'closed'

interface SaveAdvertPayload {
  id?: string
  title: string
  summary: string
  category: string
  brand_name?: string
  platforms: string[]
  deliverables: string[]
  budget_currency: string
  budget_min: number | null
  budget_max: number | null
  location: string
  hero_image: string | null
  deadline: string | null
  status?: string
  description?: string
}

export async function saveBrandAdvert(payload: SaveAdvertPayload) {
  const { id, title, summary, category, brand_name, platforms, deliverables, budget_currency, budget_min, budget_max, location, hero_image, deadline, status, description } = payload

  if (!title?.trim()) {
    return { error: 'İlan başlığı gereklidir.' }
  }

  if (!summary?.trim()) {
    return { error: 'İlan özeti gereklidir.' }
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check verification status
  const { data: userProfile } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (userProfile?.verification_status !== 'verified') {
    return { error: 'Hesabınız henüz onaylanmadı. İlan oluşturabilmek için hesabınızın onaylanması gerekmektedir.' }
  }

  const row: any = {
    title: title.trim(),
    summary: summary.trim(),
    category: category || 'Genel',
    brand_name: brand_name?.trim() || null,
    platforms: platforms || [],
    deliverables: deliverables || [],
    budget_currency: budget_currency || 'TRY',
    budget_min: budget_min ?? null,
    budget_max: budget_max ?? null,
    location: location || 'Uzaktan',
    hero_image: hero_image || null,
    deadline: deadline || null,
    brand_user_id: user.id,
    brand_id: user.id,
    description: description?.trim() || '',
  }

  if (status) {
    row.status = status
  }

  if (id) {
    const { error: updateError } = await supabase.from('advert_projects').update(row).eq('id', id).eq('brand_user_id', user.id)

    if (updateError) {
      console.error('[saveBrandAdvert] update error', updateError.message)
      return { error: `İlan güncellenemedi: ${updateError.message}` }
    }

    revalidatePath('/dashboard/brand/advert')
    return { success: true, id }
  } else {
    row.status = 'open'
    const { data: newRow, error: insertError } = await supabase.from('advert_projects').insert(row).select('id').single()

    if (insertError) {
      console.error('[saveBrandAdvert] insert error', insertError.message)
      return { error: `İlan oluşturulamadı: ${insertError.message}` }
    }

    revalidatePath('/dashboard/brand/advert')
    return { success: true, id: newRow.id }
  }
}

export async function updateAdvertStatus(advertId: string, status: 'open' | 'paused' | 'closed') {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  const { error: updateError } = await supabase.from('advert_projects').update({ status }).eq('id', advertId).eq('brand_user_id', user.id)

  if (updateError) {
    return { error: `Durum güncellenemedi: ${updateError.message}` }
  }

  revalidatePath('/dashboard/brand/advert')
  return { success: true }
}

// Create or get room for advert application
export async function getOrCreateAdvertApplicationRoom(applicationId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Get application details
  const { data: application, error: appError } = await supabase
    .from('advert_applications')
    .select('id, advert_id, influencer_id, influencer_user_id')
    .eq('id', applicationId)
    .single()

  if (appError || !application) {
    return { error: 'Başvuru bulunamadı.' }
  }

  // Get advert to find brand_user_id
  const { data: advert, error: advertError } = await supabase
    .from('advert_projects')
    .select('id, brand_user_id')
    .eq('id', application.advert_id)
    .single()

  if (advertError || !advert) {
    return { error: 'İlan bulunamadı.' }
  }

  // Check if user is brand or influencer
  const isBrand = user.id === advert.brand_user_id
  const isInfluencer = user.id === (application.influencer_id || application.influencer_user_id)

  if (!isBrand && !isInfluencer) {
    return { error: 'Bu başvuruya erişim yetkiniz yok.' }
  }

  const influencerId = application.influencer_id || application.influencer_user_id
  const brandId = advert.brand_user_id

  // Check if room already exists (by brand_id and influencer_id, or by advert_application_id if column exists)
  let existingRoom: any = null
  const { data: roomsByParticipants, error: roomError1 } = await supabase
    .from('rooms')
    .select('id, advert_application_id')
    .eq('brand_id', brandId)
    .eq('influencer_id', influencerId)
    .is('offer_id', null) // Not an offer room
    
  if (roomError1 && roomError1.code !== 'PGRST116') {
    console.error('[getOrCreateAdvertApplicationRoom] room check error', roomError1.message)
  }

  // Check if there's a room for this specific application
  if (roomsByParticipants) {
    existingRoom = roomsByParticipants.find((r: any) => r.advert_application_id === applicationId) || roomsByParticipants[0]
  }

  if (existingRoom?.id) {
    // If room exists but doesn't have advert_application_id, update it
    if (!existingRoom.advert_application_id) {
      await supabase
        .from('rooms')
        .update({ advert_application_id: applicationId })
        .eq('id', existingRoom.id)
    }
    return { success: true, roomId: existingRoom.id }
  }

  // Create new room
  const roomData: any = {
    brand_id: brandId,
    influencer_id: influencerId,
  }
  
  // Try to add advert_application_id if column exists
  try {
    roomData.advert_application_id = applicationId
  } catch {
    // Column might not exist, that's okay
  }

  const { data: newRoom, error: insertRoomError } = await supabase
    .from('rooms')
    .insert(roomData)
    .select('id')
    .single()

  if (insertRoomError) {
    console.error('[getOrCreateAdvertApplicationRoom] insert room error', insertRoomError.message)
    return { error: `Oda oluşturulamadı: ${insertRoomError.message}` }
  }

  // Update application status to indicate communication started
  await supabase
    .from('advert_applications')
    .update({ status: 'pending' }) // Keep as pending but mark that communication started
    .eq('id', applicationId)

  revalidatePath('/dashboard/brand/advert')
  revalidatePath('/dashboard/influencer/advert')
  return { success: true, roomId: newRoom.id }
}

export async function deleteAdvert(advertId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Get advert to check ownership and get hero image URL
  const { data: advert, error: fetchError } = await supabase
    .from('advert_projects')
    .select('id, hero_image, brand_user_id')
    .eq('id', advertId)
    .eq('brand_user_id', user.id)
    .single()

  if (fetchError || !advert) {
    return { error: 'İlan bulunamadı veya silme yetkiniz yok.' }
  }

  // Delete hero image from storage if exists
  if (advert.hero_image) {
    try {
      const imagePath = advert.hero_image.split('/').pop()
      if (imagePath) {
        await supabase.storage.from('advert-hero-images').remove([imagePath])
      }
    } catch (error) {
      console.error('[deleteAdvert] image delete error', error)
      // Continue with deletion even if image deletion fails
    }
  }

  // Delete the advert
  const { error: deleteError } = await supabase
    .from('advert_projects')
    .delete()
    .eq('id', advertId)
    .eq('brand_user_id', user.id)

  if (deleteError) {
    return { error: `İlan silinemedi: ${deleteError.message}` }
  }

  revalidatePath('/dashboard/brand/advert')
  return { success: true }
}
