'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { respondToOfferAs, type OfferResponse } from '@/lib/offers'

// 'hold' = "Markayla görüş": durum değişmez, pazarlık için teklif odası açılır (lib/offers.ts).
// seenEditedAt: ekrandaki teklifin edited_at değeri; marka o arada düzenlediyse kabul reddedilir.
export async function updateOfferStatus(offerId: string, nextStatus: OfferResponse, seenEditedAt?: string | null) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }

  const result = await respondToOfferAs(supabase, user.id, offerId, nextStatus, { seenEditedAt })
  if ('success' in result) {
    revalidatePath('/dashboard/works')
  }
  return result
}
