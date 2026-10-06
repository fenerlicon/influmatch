import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import SocialVerificationStep from '@/components/onboarding/SocialVerificationStep'

export const dynamic = 'force-dynamic'

/** Profil formunda girilen bağlantıdan kullanıcı adını çıkarır ("https://instagram.com/ayse" -> "ayse"). */
function usernameFromLink(link: string | null | undefined, host: string) {
  if (!link) return ''
  const value = link.trim()
  const path = value.includes(`${host}/`) ? value.split(`${host}/`)[1] : value
  return path.split(/[/?#]/)[0].replace('@', '')
}

/**
 * Kayıt akışının son adımı: influencer / UGC üreticileri Instagram veya TikTok hesaplarından
 * en az birini biyografi koduyla doğrulamadan panele giremez (bkz. app/dashboard/layout.tsx).
 */
export default async function OnboardingVerifyPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, username, full_name, social_links')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.username || !profile.full_name) {
    redirect('/onboarding')
  }
  if (profile.role !== 'influencer') {
    redirect('/dashboard')
  }

  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('platform, username, is_verified')
    .eq('user_id', user.id)
    .in('platform', ['instagram', 'tiktok'])

  if (accounts?.some((account) => account.is_verified)) {
    redirect('/dashboard')
  }

  const links = (profile.social_links ?? {}) as Record<string, string | null>
  const pendingUsername = (platform: string) => accounts?.find((account) => account.platform === platform)?.username ?? null
  const instagramUsername = pendingUsername('instagram') ?? usernameFromLink(links.instagram, 'instagram.com')
  const tiktokUsername = pendingUsername('tiktok') ?? usernameFromLink(links.tiktok, 'tiktok.com')

  return (
    <SocialVerificationStep
      userId={user.id}
      instagramUsername={instagramUsername}
      tiktokUsername={tiktokUsername}
      defaultPlatform={!instagramUsername && tiktokUsername ? 'tiktok' : 'instagram'}
    />
  )
}
