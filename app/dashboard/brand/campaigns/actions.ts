'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import {
  inviteCreatorsAs,
  linkToCampaignAs,
  listAttachablesAs,
  saveCampaignAs,
  setCampaignStatusAs,
  suggestCampaignProfilesAs,
  type CampaignInput,
  type InviteInput,
} from '@/lib/campaigns'

// Kampanya işlemleri (3.19). Rol, onay, sahiplik ve Spotlight Pro kapısı lib/campaigns.ts'te; mobil aynı fonksiyonları
// /api/mobile/campaigns uçlarından çağırır.

async function sessionUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

const NO_SESSION = { error: 'Oturumunuz bulunamadı.' } as const
const id = (value: unknown) => (typeof value === 'string' ? value : '')

function refresh(campaignId?: string) {
  revalidatePath('/dashboard/brand/campaigns')
  if (campaignId) revalidatePath(`/dashboard/brand/campaigns/${campaignId}`)
}

export async function saveCampaign(input: CampaignInput, campaignId?: string | null) {
  const { supabase, user } = await sessionUser()
  if (!user) return NO_SESSION
  const result = await saveCampaignAs(supabase, user.id, input, campaignId ? id(campaignId) : null)
  if (result.success) refresh(result.campaign.id)
  return result.success ? { success: true as const, campaignId: result.campaign.id } : { error: result.error }
}

export async function setCampaignStatus(campaignId: string, status: string) {
  const { supabase, user } = await sessionUser()
  if (!user) return NO_SESSION
  const result = await setCampaignStatusAs(supabase, user.id, id(campaignId), status)
  if (result.success) refresh(id(campaignId))
  return result
}

export async function suggestProfiles(campaignId: string) {
  const { supabase, user } = await sessionUser()
  if (!user) return NO_SESSION
  return suggestCampaignProfilesAs(supabase, user.id, id(campaignId))
}

export async function inviteCreators(campaignId: string, input: InviteInput) {
  const { supabase, user } = await sessionUser()
  if (!user) return NO_SESSION
  const result = await inviteCreatorsAs(supabase, user.id, id(campaignId), input)
  if (result.success) {
    refresh(id(campaignId))
    revalidatePath('/dashboard/works')
  }
  return result
}

export async function linkToCampaign(campaignId: string, input: { kind: 'offer' | 'advert'; id: string; attach: boolean }) {
  const { supabase, user } = await sessionUser()
  if (!user) return NO_SESSION
  const result = await linkToCampaignAs(supabase, user.id, id(campaignId), input)
  if (result.success) refresh(id(campaignId))
  return result
}

export async function getAttachables() {
  const { supabase, user } = await sessionUser()
  if (!user) return NO_SESSION
  return { success: true as const, ...(await listAttachablesAs(supabase, user.id)) }
}
