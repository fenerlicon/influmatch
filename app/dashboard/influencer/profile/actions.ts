'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { saveInfluencerProfile, type UpdateProfilePayload } from '@/lib/profile-update'
import { saveRateCardAs, type RateCard, type RateCardInput } from '@/lib/rate-card'

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


// Fiyat kartı: doğrulama ve kayıt ortak kodda (lib/rate-card.ts); mobil uç da aynısını kullanır.
export async function saveRateCard(input: RateCardInput): Promise<{ success: true; error?: undefined; rateCard: RateCard | null } | { success?: undefined; error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum bulunamadı. Lütfen yeniden giriş yapın.' }

  const result = await saveRateCardAs(supabase, user.id, input)
  if (result.success) revalidatePath('/dashboard/influencer/profile')
  return result
}
