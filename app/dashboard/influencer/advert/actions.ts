'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { applyToAdvertAs, cancelApplicationAs, type ApplyInput } from '@/lib/adverts'

// Başvuru kuralları lib/adverts.ts'te (mobil uçlar da aynı kodu kullanır).

export async function applyToAdvert(payload: ApplyInput) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await applyToAdvertAs(supabase, user.id, payload)
  if ('success' in result) revalidatePath('/dashboard/influencer/advert')
  return result
}

export async function cancelApplication(applicationId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await cancelApplicationAs(supabase, user.id, applicationId)
  if ('success' in result) revalidatePath('/dashboard/influencer/advert')
  return result
}
