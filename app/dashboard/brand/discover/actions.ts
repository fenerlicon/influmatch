'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { spinWheel } from '@/lib/discovery-wheel'

// Keşif çarkı (lib/discovery-wheel.ts). Rol, onay, bayrak ve plan kontrolü orada yapılır.
export async function spinDiscoveryWheel() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }
  const result = await spinWheel(user.id)
  if ('success' in result) revalidatePath('/dashboard/brand/discover')
  return 'success' in result ? { success: true as const } : { error: result.error }
}
