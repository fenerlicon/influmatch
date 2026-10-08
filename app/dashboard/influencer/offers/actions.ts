'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { respondToOfferAs, type OfferResponse } from '@/lib/offers'

// 'hold' = "Markayla görüş": durum değişmez, pazarlık için teklif odası açılır (lib/offers.ts).
export async function updateOfferStatus(offerId: string, nextStatus: OfferResponse) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }

  const result = await respondToOfferAs(supabase, user.id, offerId, nextStatus)
  if ('success' in result) {
    revalidatePath('/dashboard/influencer/offers')
    revalidatePath('/dashboard/offers')
  }
  return result
}
