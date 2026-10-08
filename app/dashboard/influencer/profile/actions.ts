'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { saveInfluencerProfile, type UpdateProfilePayload } from '@/lib/profile-update'

export async function updateProfile(payload: UpdateProfilePayload) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yapın.')
  }

  // Doğrulama ve kayıt ortak kodda (lib/profile-update.ts); mobil uç da aynısını kullanır.
  await saveInfluencerProfile(supabase, user.id, payload)

  // Award badges after profile update
  await awardBadgesForUser(user.id)

  revalidatePath('/dashboard/influencer/profile')
  revalidatePath('/dashboard/influencer/discover')
  revalidatePath(`/profile/${payload.username}`)
  revalidatePath(`/dashboard/influencer/badges`)
  if (payload.previousUsername && payload.previousUsername !== payload.username) {
    revalidatePath(`/profile/${payload.previousUsername}`)
  }

  return { success: true }
}

