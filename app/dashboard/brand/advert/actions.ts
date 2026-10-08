'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import {
  deleteAdvertAs,
  openApplicationRoomAs,
  saveAdvertAs,
  updateAdvertStatusAs,
  updateApplicationStatusAs,
  type AdvertStatus,
  type ApplicationStatus,
  type SaveAdvertInput,
} from '@/lib/adverts'

export type { AdvertStatus }

// İlan ve başvuru kuralları lib/adverts.ts'te (mobil uçlar da aynı kodu kullanır).

async function currentUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function saveBrandAdvert(payload: SaveAdvertInput) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await saveAdvertAs(supabase, user.id, payload)
  if ('success' in result) revalidatePath('/dashboard/brand/advert')
  return result
}

export async function updateAdvertStatus(advertId: string, status: AdvertStatus) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await updateAdvertStatusAs(supabase, user.id, advertId, status)
  if ('success' in result) revalidatePath('/dashboard/brand/advert')
  return result
}

export async function getOrCreateAdvertApplicationRoom(applicationId: string) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await openApplicationRoomAs(supabase, user.id, applicationId)
  if ('success' in result) {
    revalidatePath('/dashboard/brand/advert')
    revalidatePath('/dashboard/influencer/advert')
  }
  return result
}

export async function deleteAdvert(advertId: string) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await deleteAdvertAs(supabase, user.id, advertId)
  if ('success' in result) revalidatePath('/dashboard/brand/advert')
  return result
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

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus) {
  const { supabase, user } = await currentUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await updateApplicationStatusAs(supabase, user.id, applicationId, status)
  if ('success' in result) revalidatePath('/dashboard/brand/advert')
  return result
}
