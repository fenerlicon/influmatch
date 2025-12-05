'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function dismissInfluencer(receiverUserId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Insert dismissed offer (indexes enforce uniqueness)
  const { error } = await supabase
    .from('dismissed_offers')
    .insert({
      user_id: user.id,
      receiver_user_id: receiverUserId,
    })

  if (error) {
    // If unique violation (already dismissed), consider it success
    if (error.code === '23505') {
      return { success: true }
    }
    console.error('Dismiss influencer error:', error)
    return { error: `Influencer gizlenemedi: ${error.message}` }
  }

  revalidatePath('/dashboard/brand/offers')
  return { success: true }
}

export async function undismissInfluencer(receiverUserId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  const { error } = await supabase
    .from('dismissed_offers')
    .delete()
    .eq('user_id', user.id)
    .eq('receiver_user_id', receiverUserId)

  if (error) {
    console.error('Undismiss influencer error:', error)
    return { error: `Influencer geri getirilemedi: ${error.message}` }
  }

  revalidatePath('/dashboard/brand/offers')
  return { success: true }
}

