import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import IncompleteProfileBanner from '@/components/dashboard/IncompleteProfileBanner'
import EmailVerificationBanner from '@/components/dashboard/EmailVerificationBanner'
import MVPBanner from '@/components/dashboard/MVPBanner'
import PageTransition from '@/components/layout/PageTransition'
import type { UserRole } from '@/types/auth'
import { createSupabaseServerClient } from '@/utils/supabase/server'

import RejectedScreen from '@/components/dashboard/RejectedScreen'

const PROFILE_SELECT = 'role, verification_status, social_links, bio, category, city, avatar_url, username, full_name'

function ProfileLoadError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0C10] p-4 text-white">
      <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-400">Profil yüklenemedi</h1>
        <p className="mb-6 text-gray-300">Hesap bilgilerinize şu anda ulaşamıyoruz. Lütfen birkaç saniye sonra tekrar deneyin.</p>
        <a href="/dashboard" className="rounded-xl bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20">
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

  const fullName = user.user_metadata?.full_name ?? user.email ?? 'Kullanıcı'

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

  // Use the profile we found
  const finalUserProfile = userProfile
  // Rol her zaman DB'den: user_metadata.role kullanıcı tarafından değiştirilebilir.
  const role = (finalUserProfile.role ?? 'influencer') as UserRole

  // Check if profile is complete (has username and full_name)
  // If not, redirect to onboarding to complete the profile
  if (!finalUserProfile.username || !finalUserProfile.full_name) {
    redirect('/onboarding')
  }

  const verificationStatus = finalUserProfile.verification_status ?? 'pending'
  const showGenericVerificationBanner = verificationStatus === 'pending'
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

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardSidebar role={role} fullName={fullName} email={user.email} />
        <div className="flex flex-1 flex-col bg-[#0F1014]">
          <DashboardHeader role={role} fullName={fullName} userId={user.id} />
          {!isEmailConfirmed && (
            <EmailVerificationBanner userEmail={user.email || ''} />
          )}
          <MVPBanner />


          {showGenericVerificationBanner && (
            <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3 sm:px-6 lg:px-10">
              <div className="mx-auto flex items-center gap-3 text-sm text-yellow-200">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p>
                  Hesabınız henüz onaylanmadı. Tüm özelliklere erişmek için profilinizi tamamlayın ve onay bekleyin.
                </p>
              </div>
            </div>
          )}
          <IncompleteProfileBanner
            userId={user.id}
            role={role}
            initialVerificationStatus={verificationStatus}
            initialSocialLinks={socialLinks}
          />
          <div className="flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </div>
    </div>
  )
}
