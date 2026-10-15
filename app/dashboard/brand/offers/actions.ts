'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { editOfferAs, withdrawOfferAs, type CreateOfferInput } from '@/lib/offers'

// Marka bekleyen teklifini geri çeker ya da düzenler (2026-10-14). Kurallar ve bildirimler lib/offers.ts'te;
// mobil aynı fonksiyonları /api/mobile/offers/[id] ucundan çağırır.

async function sessionUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function withdrawOffer(offerId: string) {
  const { supabase, user } = await sessionUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }
  const result = await withdrawOfferAs(supabase, user.id, offerId)
  if ('success' in result) revalidatePath('/dashboard/works')
  return result
}

export async function editOffer(offerId: string, input: Omit<CreateOfferInput, 'receiverId'>) {
  const { supabase, user } = await sessionUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }
  const result = await editOfferAs(supabase, user.id, offerId, input)
  if ('success' in result) revalidatePath('/dashboard/works')
  return result
}
