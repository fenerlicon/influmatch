'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { setBrandPortfolioSettingAs, setPortfolioItemHiddenAs } from '@/lib/portfolio-results'

// Portföy sonuçları (4.3-S7): yazımlar lib/portfolio-results.ts'te (mobil /api/mobile/portfolio aynı kodu çağırır).

export async function setPortfolioItemHidden(collaborationId: string, hidden: boolean) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await setPortfolioItemHiddenAs(supabase, user.id, collaborationId, hidden)
  if ('success' in result) {
    revalidatePath('/dashboard/influencer/settings')
    revalidatePath('/profile/[username]', 'page')
  }
  return result
}

export async function setBrandPortfolioName(showBrandName: boolean) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await setBrandPortfolioSettingAs(supabase, user.id, showBrandName)
  if ('success' in result) revalidatePath('/dashboard/brand/settings')
  return result
}
