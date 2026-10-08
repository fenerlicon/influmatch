'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createOfferAs } from '@/lib/offers'

interface CreateOfferPayload {
  receiverId: string
  campaignName: string
  campaignType: string
  budget: string
  message: string
  paymentType: 'cash' | 'barter'
}

export async function createOffer(payload: CreateOfferPayload) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum bulunamadı. Lütfen yeniden giriş yapın.' }

  return createOfferAs(supabase, user.id, payload)
}
