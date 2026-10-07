import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/utils/supabase/server'

/**
 * Hesap rolünün tek doğru kaynağı public.users.role kolonudur.
 * auth user_metadata.role kayıt URL'sinden gelir ve kullanıcı auth.updateUser ile
 * değiştirebilir; yönlendirme veya yetki kararı için ASLA kullanılmaz.
 */
export type AccountRole = 'influencer' | 'brand' | 'admin'

export function normalizeAccountRole(value: unknown): AccountRole | null {
  return value === 'influencer' || value === 'brand' || value === 'admin' ? value : null
}

export async function fetchAccountRole(supabase: SupabaseClient, userId: string): Promise<AccountRole | null> {
  const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
  return normalizeAccountRole(data?.role)
}

/** Oturumdaki kullanıcı ve DB rolü; aynı istek içinde tek sorgu (layout ve sayfalar paylaşır). */
export const getViewer = cache(async () => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { user, role: await fetchAccountRole(supabase, user.id) }
})

export function dashboardHomeFor(role: AccountRole | null): string {
  if (role === 'brand') return '/dashboard/brand'
  if (role === 'admin') return '/admin'
  if (role === 'influencer') return '/dashboard/influencer'
  return '/onboarding'
}
