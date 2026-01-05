'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'

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
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yapın.')
  }

  if (user.user_metadata?.role !== 'brand') {
    throw new Error('Sadece marka hesapları teklif gönderebilir.')
  }

  // Check verification status
  const { data: userProfile } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (userProfile?.verification_status !== 'verified') {
    throw new Error('Hesabınız henüz onaylanmadı. Teklif gönderebilmek için hesabınızın onaylanması gerekmektedir.')
  }

  const budgetValue = payload.budget ? Number(payload.budget) : null

  const { error } = await supabase.from('offers').insert({
    sender_user_id: user.id,
    receiver_user_id: payload.receiverId,
    campaign_name: payload.campaignName,
    campaign_type: payload.campaignType,
    budget: budgetValue,
    message: payload.message,
    status: 'pending',
    payment_type: payload.paymentType,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

