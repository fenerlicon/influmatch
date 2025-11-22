'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function updateDisplayedBadges(badgeIds: string[]) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yapın.')
  }

  // Validate max 3 badges
  if (badgeIds.length > 3) {
    throw new Error('Maksimum 3 rozet seçebilirsiniz.')
  }

  // Verify that user has earned these badges
  const { data: userBadges, error: badgesError } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', user.id)
    .in('badge_id', badgeIds)

  if (badgesError) {
    console.error('Error checking user badges:', badgesError)
    throw new Error('Rozet kontrolü yapılamadı.')
  }

  const earnedBadgeIds = new Set(userBadges?.map((b) => b.badge_id) ?? [])
  const invalidBadges = badgeIds.filter((id) => !earnedBadgeIds.has(id))

  if (invalidBadges.length > 0) {
    throw new Error('Seçtiğiniz rozetlerden bazılarına sahip değilsiniz.')
  }

  // Update displayed_badges
  const { error: updateError } = await supabase
    .from('users')
    .update({ displayed_badges: badgeIds })
    .eq('id', user.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  revalidatePath('/dashboard/brand/profile')
  revalidatePath('/dashboard/influencer/discover')
  revalidatePath('/dashboard/brand/discover')
  revalidatePath('/profile/[username]', 'page')

  return { success: true }
}

