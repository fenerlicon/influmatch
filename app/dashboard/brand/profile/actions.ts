'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { saveBrandProfile as saveBrandProfileAs, type UpdateBrandProfilePayload } from '@/lib/profile-update'

export type UpdateBrandProfileResult = { success: true } | { success: false; error: string }

/**
 * Doğrulama hataları istemciye mesaj olarak döner. Server action'dan fırlatılan hatalar
 * production'da gizlenir ve kullanıcı uyarı yerine hata sayfası/genel mesaj görür.
 */
export async function updateBrandProfile(payload: UpdateBrandProfilePayload): Promise<UpdateBrandProfileResult> {
  try {
    return await saveBrandProfile(payload)
  } catch (error) {
    console.error('[updateBrandProfile]', error)
    return { success: false, error: error instanceof Error ? error.message : 'Profil güncellenemedi.' }
  }
}

async function saveBrandProfile(payload: UpdateBrandProfilePayload): Promise<{ success: true }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yapın.')
  }

  // Doğrulama ve kayıt ortak kodda (lib/profile-update.ts); mobil uç da aynısını kullanır.
  await saveBrandProfileAs(supabase, user.id, payload)

  // Award badges after profile update
  await awardBadgesForUser(user.id)

  revalidatePath('/dashboard/brand/profile')
  revalidatePath('/dashboard/brand')
  revalidatePath('/dashboard/brand/advert')
  revalidatePath('/dashboard/brand/discover')
  revalidatePath(`/dashboard/brand/badges`)

  return { success: true as const }
}


