import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import IncompleteProfileBanner from '@/components/dashboard/IncompleteProfileBanner'
import EmailVerificationBanner from '@/components/dashboard/EmailVerificationBanner'
import PageTransition from '@/components/layout/PageTransition'
import type { UserRole } from '@/types/auth'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = (user.user_metadata?.role ?? 'influencer') as UserRole
  const fullName = user.user_metadata?.full_name ?? user.email ?? 'Kullanıcı'

  // Check email confirmation status
  const isEmailConfirmed = !!user.email_confirmed_at

  // Check verification status and profile completeness
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('verification_status, social_links, bio, category, city, avatar_url, username, full_name')
    .eq('id', user.id)
    .maybeSingle()

  // Log any errors for debugging
  if (profileError) {
    console.error('[DashboardLayout] Profile query error:', profileError)
  }

  // If user profile doesn't exist in public.users
  if (!userProfile) {
    // Try to create a basic profile first (in case trigger didn't run)
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'influencer',
        full_name: user.user_metadata?.full_name || null,
        username: user.user_metadata?.username || null,
      })

    if (insertError) {
      // Insert failed - check the error type
      console.error('[DashboardLayout] Profile insert error:', insertError)

      // If it's a conflict (profile already exists but query failed), try to fetch again
      if (insertError.code === '23505' || insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
        // Profile might exist but query failed - redirect to onboarding to let user complete it
        redirect('/onboarding')
      } else if (insertError.message.includes('row-level security') || insertError.code === '42501') {
        // RLS issue - redirect to onboarding
        redirect('/onboarding')
      } else {
        // Other error - assume profile doesn't exist and redirect to onboarding
        // Don't sign out - let user complete onboarding
        redirect('/onboarding')
      }
    } else {
      // Profile created successfully, reload the page to get the profile
      redirect('/dashboard')
    }
  }

  // Use the profile we found
  const finalUserProfile = userProfile

  // Check if profile is complete (has username and full_name)
  // If not, redirect to onboarding to complete the profile
  if (!finalUserProfile.username || !finalUserProfile.full_name) {
    redirect('/onboarding')
  }

  const verificationStatus = finalUserProfile.verification_status ?? 'pending'
  const showVerificationBanner = verificationStatus === 'pending'
  const socialLinks = (finalUserProfile.social_links as Record<string, string | null> | null) ?? {}

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardSidebar role={role} fullName={fullName} email={user.email} />
        <div className="flex flex-1 flex-col bg-[#0F1014]">
          <DashboardHeader role={role} fullName={fullName} userId={user.id} />
          {!isEmailConfirmed && (
            <EmailVerificationBanner userEmail={user.email || ''} />
          )}
          {showVerificationBanner && (
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
                  Hesabınız şu an inceleme aşamasındadır. Onaylanana kadar bazı özellikler kısıtlıdır.
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


