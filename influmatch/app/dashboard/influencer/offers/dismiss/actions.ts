'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function dismissOffer(offerId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Verify that the offer belongs to the current user (influencer)
  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id, receiver_user_id')
    .eq('id', offerId)
    .single()

  if (offerError || !offer) {
    return { error: 'Teklif bulunamadı.' }
  }

  if (offer.receiver_user_id !== user.id) {
    return { error: 'Bu teklif üzerinde işlem yapma yetkiniz yok.' }
  }

  // Insert dismissed offer (ignore if already exists due to unique constraint)
  const { error } = await supabase.from('dismissed_offers').insert({
    user_id: user.id,
    offer_id: offerId,
  })

  // Ignore unique constraint violation (already dismissed)
  if (error && error.code !== '23505') {
    console.error('Dismiss offer error:', error)
    return { error: `Teklif gizlenemedi: ${error.message}` }
  }

  if (error) {
    console.error('Dismiss offer error:', error)
    return { error: `Teklif gizlenemedi: ${error.message}` }
  }

  revalidatePath('/dashboard/offers')
  revalidatePath('/dashboard/influencer/offers')
  return { success: true }
}

export async function undismissOffer(offerId: string) {
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
    .eq('offer_id', offerId)

  if (error) {
    console.error('Undismiss offer error:', error)
    return { error: `Teklif geri getirilemedi: ${error.message}` }
  }

  revalidatePath('/dashboard/offers')
  revalidatePath('/dashboard/influencer/offers')
  return { success: true }
}

