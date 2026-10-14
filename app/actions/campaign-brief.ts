'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { briefsForOffers, type CampaignBrief } from '@/lib/campaigns'

/**
 * Teklifin kampanya brief'i (3.19). Teklif oturum istemcisiyle okunur: RLS yalnızca alıcı influencer'a ve gönderen markaya
 * satır döndürür; böylece başka tekliflerin brief'i alınamaz. Brief salt okunur ve markaya özel alanları içermez.
 */
export async function getOfferCampaignBrief(offerId: string): Promise<{ brief: CampaignBrief | null } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }
  if (typeof offerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(offerId)) return { error: 'Teklif bulunamadı.' }
  const { data: offer } = await supabase
    .from('offers')
    .select('id, campaign_id, sender_user_id, receiver_user_id')
    .eq('id', offerId)
    .maybeSingle()
  if (!offer || (offer.receiver_user_id !== user.id && offer.sender_user_id !== user.id)) return { error: 'Teklif bulunamadı.' }
  const briefs = await briefsForOffers([{ id: offer.id as string, campaign_id: offer.campaign_id as string | null }])
  return { brief: briefs.get(offer.id as string) ?? null }
}
