'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'
import { displayNameOf, notifyUser } from '@/lib/notify'

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
    return { error: 'Oturum bulunamadı. Lütfen yeniden giriş yapın.' }
  }

  if ((await fetchAccountRole(supabase, user.id)) !== 'brand') {
    return { error: 'Sadece marka hesapları teklif gönderebilir.' }
  }

  // Check verification status
  const { data: userProfile } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (userProfile?.verification_status !== 'verified') {
    return { error: 'Hesabınız henüz onaylanmadı. Teklif gönderebilmek için hesabınızın onaylanması gerekmektedir.' }
  }

  if ((await fetchAccountRole(supabase, payload.receiverId)) !== 'influencer') {
    return { error: 'Teklif yalnızca influencer/UGC hesaplarına gönderilebilir.' }
  }

  const campaignName = payload.campaignName?.trim() ?? ''
  if (!campaignName || campaignName.length > 120) {
    return { error: 'Kampanya adı 1-120 karakter olmalı.' }
  }

  const paymentType = payload.paymentType === 'barter' ? 'barter' : 'cash'
  const budgetValue = payload.budget?.toString().trim() ? Number(payload.budget) : null
  if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0 || budgetValue > 100_000_000)) {
    return { error: 'Bütçe geçerli bir tutar olmalı.' }
  }

  const { error } = await supabase.from('offers').insert({
    sender_user_id: user.id,
    receiver_user_id: payload.receiverId,
    campaign_name: campaignName,
    campaign_type: payload.campaignType,
    budget: budgetValue,
    payment_type: paymentType,
    message: payload.message?.trim() || null,
    status: 'pending',
  })

  if (error) {
    console.error('[createOffer] insert error:', error)
    return { error: 'Teklif gönderilemedi. Lütfen tekrar deneyin.' }
  }

  const admin = createSupabaseAdminClient()
  const brandName = await displayNameOf(admin, user.id)
  await notifyUser(
    {
      userId: payload.receiverId,
      event: 'offer_new',
      title: 'Yeni teklif aldınız',
      message: `${brandName} size "${campaignName}" kampanyası için teklif gönderdi.`,
      link: '/dashboard/offers',
    },
    admin,
  )

  return { success: true }
}
