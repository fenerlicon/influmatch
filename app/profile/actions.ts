'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createOfferAs } from '@/lib/offers'
import {
  deleteOfferTemplateAs,
  lastOfferDraftAs,
  listOfferTemplatesAs,
  saveOfferTemplateAs,
  type SaveOfferTemplateInput,
} from '@/lib/offer-templates'

interface CreateOfferPayload {
  receiverId: string
  campaignName: string
  campaignType: string
  budget: string
  message: string
  paymentType: 'cash' | 'barter'
}

async function currentUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

const NO_SESSION = { error: 'Oturum bulunamadı. Lütfen yeniden giriş yapın.' } as const

export async function createOffer(payload: CreateOfferPayload) {
  const { supabase, user } = await currentUser()
  if (!user) return NO_SESSION
  return createOfferAs(supabase, user.id, payload)
}

// ---- Teklif şablonları (lib/offer-templates.ts); rol ve sahiplik orada kontrol edilir ----

export async function listOfferTemplates() {
  const { supabase, user } = await currentUser()
  if (!user) return NO_SESSION
  return listOfferTemplatesAs(supabase, user.id)
}

export async function saveOfferTemplate(input: SaveOfferTemplateInput) {
  const { supabase, user } = await currentUser()
  if (!user) return NO_SESSION
  return saveOfferTemplateAs(supabase, user.id, input)
}

export async function deleteOfferTemplate(templateId: string) {
  const { supabase, user } = await currentUser()
  if (!user) return NO_SESSION
  return deleteOfferTemplateAs(supabase, user.id, typeof templateId === 'string' ? templateId : '')
}

export async function getLastOfferDraft() {
  const { supabase, user } = await currentUser()
  if (!user) return NO_SESSION
  return lastOfferDraftAs(supabase, user.id)
}
