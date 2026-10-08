'use server'

import { setShowcaseVisibilityAs } from '@/lib/showcase'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function toggleShowcaseVisibility(nextValue: boolean) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
  }

  // Kurallar ortak kodda (lib/showcase.ts); mobil uç da aynısını kullanır.
  await setShowcaseVisibilityAs(supabase, user, nextValue)

  revalidatePath('/dashboard/influencer')
  revalidatePath('/dashboard/brand/discover')
  return { success: true }
}

