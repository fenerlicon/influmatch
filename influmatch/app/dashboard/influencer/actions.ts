'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function toggleSpotlight(nextValue: boolean) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
  }

  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  if (!existing) {
    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role ?? 'influencer',
      full_name: user.user_metadata?.full_name ?? null,
      username: user.user_metadata?.username ?? null,
      spotlight_active: nextValue,
    })

    if (insertError) {
      throw new Error(insertError.message)
    }
  } else {
    const { error: updateError } = await supabase.from('users').update({ spotlight_active: nextValue }).eq('id', user.id)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  revalidatePath('/dashboard/influencer')
  return { success: true }
}

