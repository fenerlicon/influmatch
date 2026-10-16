import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import ShellNotices, { type ShellNotice } from '@/components/shell/ShellNotices'
import { SHELL_USER_COLUMNS, buildShellUser } from '@/lib/shell-user'
import { createSupabaseServerClient } from '@/utils/supabase/server'

import RejectedScreen from '@/components/dashboard/RejectedScreen'
import { buttonClasses } from '@/components/ui'

const PROFILE_SELECT = `${SHELL_USER_COLUMNS}, verification_status, social_links, bio, category, city`

function ProfileLoadError() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface-1 p-7 text-center">
        <h1 className="font-display text-[24px] leading-tight text-ink">Profil yüklenemedi</h1>
        <p className="mt-2 text-[13.5px] text-ink-muted">Hesap bilgilerine şu anda ulaşamıyoruz. Birkaç saniye sonra tekrar dene.</p>
        <a href="/dashboard" className={buttonClasses({ variant: 'primary', className: 'mt-5' })}>
          Tekrar dene
        </a>
      </div>
    </div>
  )
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check email confirmation status
  const isEmailConfirmed = !!user.email_confirmed_at

  // Check verification status and profile completeness
  const { data: existingProfile, error: profileError } = await supabase
    .from('users')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle()

  // Sorgu hatası "profil yok" demek değildir: bu durumda satır açmaya ya da onboarding'e
  // göndermeye çalışmak, geçici bir veritabanı hatasında dashboard ↔ onboarding döngüsü yaratıyordu.
  if (profileError) {
    console.error('[DashboardLayout] Profile query error:', profileError)
    return <ProfileLoadError />
  }

  let userProfile = existingProfile

  // If user profile doesn't exist in public.users
  if (!userProfile) {
    // Try to create a basic profile first (in case trigger didn't run)
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role === 'brand' ? 'brand' : 'influencer',
        full_name: user.user_metadata?.full_name || null,
        username: user.user_metadata?.username || null,
      })

    // Çakışma: satır bu arada (ör. tetikleyiciyle) oluşmuş olabilir; bir kez daha okunur.
    if (insertError && insertError.code !== '23505') {
      console.error('[DashboardLayout] Profile insert error:', insertError)
      return <ProfileLoadError />
    }

    const { data: createdProfile, error: refetchError } = await supabase
      .from('users')
      .select(PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle()

    if (refetchError || !createdProfile) {
      console.error('[DashboardLayout] Profile refetch error:', refetchError ?? 'profile still missing')
      return <ProfileLoadError />
    }
    userProfile = createdProfile
  }

  const finalUserProfile = userProfile

  // Check if profile is complete (has username and full_name)
  // If not, redirect to onboarding to complete the profile
  if (!finalUserProfile.username || !finalUserProfile.full_name) {
    redirect('/onboarding')
  }

  const verificationStatus = finalUserProfile.verification_status ?? 'pending'
  const socialLinks = (finalUserProfile.social_links as Record<string, string | null> | null) ?? {}

  // Check if account is rejected/banned
  if (verificationStatus === 'rejected') {
    return <RejectedScreen />
  }

  // Influencer / UGC hesapları Instagram veya TikTok hesaplarından en az birini
  // doğrulamadan panele giremez (yeni ve mevcut kullanıcılar için aynı kural).
  if (finalUserProfile.role === 'influencer') {
    const { data: verifiedAccount } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .in('platform', ['instagram', 'tiktok'])
      .eq('is_verified', true)
      .limit(1)
      .maybeSingle()

    if (!verifiedAccount) {
      redirect('/onboarding/verify')
    }
  }

  // Rol her zaman DB'den: user_metadata.role kullanıcı tarafından değiştirilebilir.
  const shellUser = buildShellUser(user, finalUserProfile)

  // Tek bildirim alanı; sıra = önem. (Eski dört bant: e-posta, sosyal hesap, onay bekleniyor, MVP — MVP notu kenar çubuğunda.)
  const notices: ShellNotice[] = []
  if (!user.email_confirmed_at) notices.push({ kind: 'email_unconfirmed', email: user.email ?? '' })
  if (verificationStatus === 'pending') {
    const hasSocialLink = Object.values(socialLinks).some((link) => typeof link === 'string' && link.trim().length > 0)
    if (!hasSocialLink) {
      notices.push({ kind: 'social_missing', profileHref: shellUser.role === 'brand' ? '/dashboard/brand/profile' : '/dashboard/influencer/profile' })
    }
    notices.push({ kind: 'verification_pending' })
  }

  return (
    <AppShell user={shellUser} notices={<ShellNotices notices={notices} />}>
      {children}
    </AppShell>
  )
}
