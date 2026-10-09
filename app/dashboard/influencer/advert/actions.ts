'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { applyToAdvertAs, cancelApplicationAs, type ApplyInput } from '@/lib/adverts'
import { createAdvertAlertAs, deleteAdvertAlertAs, setAdvertSavedAs, type AdvertAlertInput } from '@/lib/advert-alerts'

// Başvuru kuralları lib/adverts.ts'te, kaydetme ve alarmlar lib/advert-alerts.ts'te (mobil uçlar da aynı kodu kullanır).

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

export async function setAdvertSaved(advertId: string, saved: boolean) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  return setAdvertSavedAs(supabase, user.id, typeof advertId === 'string' ? advertId : '', saved === true)
}

export async function createAdvertAlert(input: AdvertAlertInput) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  return createAdvertAlertAs(supabase, user.id, input ?? {})
}

export async function deleteAdvertAlert(alertId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  return deleteAdvertAlertAs(supabase, user.id, typeof alertId === 'string' ? alertId : '')
}
