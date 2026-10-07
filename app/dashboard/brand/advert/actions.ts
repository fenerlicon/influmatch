'use server'

import { storagePathFromPublicUrl } from '@/lib/account-deletion'
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
  payment_type?: string
  custom_questions?: any[]
}

export async function saveBrandAdvert(payload: SaveAdvertPayload) {
  const { id, title, summary, category, brand_name, platforms, deliverables, budget_currency, budget_min, budget_max, location, hero_image, deadline, status, description, payment_type, custom_questions } = payload

  if (!title?.trim()) {
    return { error: 'İlan başlığı gereklidir.' }
  }

  if (!summary?.trim()) {
    return { error: 'İlan özeti gereklidir.' }
  }

  if (!hero_image || !hero_image.trim()) {
    return { error: 'İlan kapak fotoğrafı yüklenmesi zorunludur.' }
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
  }

  // Form açıklama alanı göndermiyor: güncellemede mevcut açıklama ezilmesin, yeni ilanda boş başlasın.
  if (description !== undefined) row.description = description?.trim() || ''
  else if (!id) row.description = ''

  if (payment_type) row.payment_type = payment_type
  // Boş dizi de yazılır: markanın tüm soruları silmesi güncellemeye yansısın.
  if (Array.isArray(custom_questions)) row.custom_questions = custom_questions

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

  // Yalnızca bu başvuruya ait oda yeniden kullanılır. Eskiden çift arasındaki herhangi bir oda
  // (ör. başka bir ilanın) alınıp advert_application_id güncellenmeye çalışılıyordu; rooms için
  // UPDATE politikası olmadığından bu sessizce başarısız oluyordu. Mesaj kutusu odaları karşı
  // tarafa göre zaten birleştirir.
  const { data: existingRoom, error: roomError } = await supabase
    .from('rooms')
    .select('id')
    .eq('advert_application_id', applicationId)
    .limit(1)
    .maybeSingle()

  if (roomError) {
    console.error('[getOrCreateAdvertApplicationRoom] room check error', roomError.message)
  }
  if (existingRoom?.id) {
    return { success: true, roomId: existingRoom.id }
  }

  const { data: newRoom, error: insertRoomError } = await supabase
    .from('rooms')
    .insert({ brand_id: brandId, influencer_id: influencerId, advert_application_id: applicationId })
    .select('id')
    .single()

  if (insertRoomError) {
    console.error('[getOrCreateAdvertApplicationRoom] insert room error', insertRoomError.message)
    return { error: `Oda oluşturulamadı: ${insertRoomError.message}` }
  }

  // Not: başvuru durumu burada değiştirilmez (eskiden 'pending'e çekiliyordu; kabul edilmiş
  // bir başvuru sohbet açılınca beklemeye düşebiliyordu).

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
      // Dosya yolu adresten çıkarılır (klasörlü yüklemelerde de doğru yolu siler).
      const stored = storagePathFromPublicUrl(advert.hero_image)
      if (stored?.bucket === 'advert-hero-images') {
        await supabase.storage.from('advert-hero-images').remove([stored.path])
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

/**
 * Fetches applications for specific projects using service role to bypass RLS.
 * This is used as a workaround for complex RLS issues preventing brands from seeing applications.
 */
export async function getBrandApplicationsAdmin(projectIds: string[]) {
  if (!Array.isArray(projectIds) || projectIds.length === 0) return { applications: [] }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.', applications: [] }
  }

  // Okumalar oturum istemcisiyle: canlı RLS markaya yalnızca kendi ilanlarının başvurularını
  // gösteriyor. Sahiplik ayrıca burada da kontrol edilir.
  // Sadece oturumdaki markaya ait ilanların başvuruları döndürülür.
  const { data: ownedProjects, error: ownedError } = await supabase
    .from('advert_projects')
    .select('id')
    .in('id', projectIds)
    .eq('brand_user_id', user.id)

  if (ownedError) {
    console.error('[getBrandApplicationsAdmin] Ownership check error:', ownedError)
    return { error: 'Başvurular alınamadı.', applications: [] }
  }

  const ownedIds = (ownedProjects ?? []).map((project) => project.id)
  if (ownedIds.length === 0) return { applications: [] }

  const { data, error } = await supabase
    .from('advert_applications')
    .select(`
      id, 
      advert_id, 
      influencer_id, 
      cover_letter, 
      deliverable_idea, 
      budget_expectation, 
      status, 
      created_at,
      influencer:users!influencer_user_id (
        id,
        full_name,
        username,
        avatar_url,
        verification_status,
        displayed_badges
      ),
      advert:advert_id (
        title,
        category
      )
    `)
    .in('advert_id', ownedIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getBrandApplicationsAdmin] Error:', error)
    return { error: 'Başvurular alınamadı.', applications: [] }
  }

  return { applications: data || [] }
}

/**
 * Updates an application status (rejected, shortlisted, accepted, pending)
 */
export async function updateApplicationStatus(applicationId: string, status: 'pending' | 'shortlisted' | 'rejected' | 'accepted') {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  if (!['pending', 'shortlisted', 'rejected', 'accepted'].includes(status)) {
    return { error: 'Geçersiz durum.' }
  }

  // Oturum istemcisiyle: RLS başvuruyu yalnızca ilan sahibine gösterir ve günceller.
  const { data: application, error: appError } = await supabase
    .from('advert_applications')
    .select('id, advert_id')
    .eq('id', applicationId)
    .maybeSingle()

  if (appError || !application) {
    return { error: 'Başvuru bulunamadı.' }
  }

  const { data: advert, error: advertError } = await supabase
    .from('advert_projects')
    .select('id, brand_user_id')
    .eq('id', application.advert_id)
    .maybeSingle()

  if (advertError || !advert) {
    return { error: 'İlan bulunamadı.' }
  }

  if (advert.brand_user_id !== user.id) {
    return { error: 'Bu başvuruyu güncelleme yetkiniz yok.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('advert_applications')
    .update({ status })
    .eq('id', applicationId)
    .select('id')

  if (updateError) {
    return { error: `Durum güncellenemedi: ${updateError.message}` }
  }
  if (!updated || updated.length === 0) {
    return { error: 'Bu başvuruyu güncelleme yetkiniz yok.' }
  }

  revalidatePath('/dashboard/brand/advert')
  return { success: true }
}
