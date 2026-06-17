'use server'

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

  // Check verification status
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  // Check if user is verified
  if (profile?.verification_status !== 'verified') {
    throw new Error('HESABINIZ ONAYLANANA KADAR VİTRİNE ÇIKAMAZSINIZ')
  }

  // Check if user has connected accounts
  const { data: socialAccounts, error: socialError } = await supabase
    .from('social_accounts')
    .select('platform, has_stats, is_verified')
    .eq('user_id', user.id)

  if (socialError) {
    throw new Error(socialError.message)
  }

  const hasConnected = !!(socialAccounts && socialAccounts.some(acc => 
    acc.has_stats || (acc.platform === 'tiktok' && acc.is_verified)
  ))

  if (nextValue && !hasConnected) {
    throw new Error('Hiçbir resmi sosyal medya hesabınızı bağlamadığınız için vitrin modunu aktif edemezsiniz.')
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
      is_showcase_visible: nextValue,
    })

    if (insertError) {
      throw new Error(insertError.message)
    }
  } else {
    const { error: updateError } = await supabase.from('users').update({ is_showcase_visible: nextValue }).eq('id', user.id)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  // Send notification if enabled
  if (nextValue) {
    const { sendSpotlightNotification } = await import('@/app/actions/automated-messages')
    await sendSpotlightNotification(user.id, true).catch(e => console.error('Spotlight notification error:', e))
  }

  revalidatePath('/dashboard/influencer')
  revalidatePath('/dashboard/brand/discover')
  return { success: true }
}

