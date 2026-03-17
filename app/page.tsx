import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import Hero from '@/components/landing/Hero'
import FeaturesSection from '@/components/landing/FeaturesSection'
import DetailedStatsSection from '@/components/landing/DetailedStatsSection'
import VerificationCTA from '@/components/landing/VerificationCTA'
import ValueProposition from '@/components/landing/ValueProposition'
import BadgesSection from '@/components/landing/BadgesSection'
import FAQSection from '@/components/landing/FAQSection'
import Spotlight, { type SpotlightInfluencer } from '@/components/landing/Spotlight'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

interface HomeProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function Home({ searchParams }: HomeProps) {
  // Check for error parameters from Supabase email verification
  const error = typeof searchParams.error === 'string' ? searchParams.error : null
  const errorCode = typeof searchParams.error_code === 'string' ? searchParams.error_code : null

  if (error || errorCode) {
    let errorMessage = 'verification_failed'
    if (errorCode === 'otp_expired') {
      errorMessage = 'email_link_expired'
    } else if (error === 'access_denied') {
      errorMessage = 'verification_denied'
    }
    redirect(`/login?error=${errorMessage}`)
  }

  // Fetch real influencers from DB for landing page showcase.
  // Uses admin client (service_role) to bypass RLS — landing page is public.
  let spotlightInfluencers: SpotlightInfluencer[] = []

  try {
    const supabase = createSupabaseAdminClient()
    if (!supabase) {
      console.error('[Home] Admin client is null — SUPABASE_SERVICE_ROLE_KEY missing?')
    } else {
      // Step 1: Fetch influencers — minimal filters, no joins
      const { data: influencers, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, username, category, city, avatar_url, spotlight_active, verification_status')
        .eq('role', 'influencer')
        .eq('verification_status', 'verified')
        .eq('spotlight_active', true)
        .not('username', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (usersError) {
        console.error('[Home] Users query error:', usersError)
      } else if (influencers && influencers.length > 0) {
        console.log(`[Home] Found ${influencers.length} influencers`)

        // Step 2: Fetch social accounts for these users
        const userIds = influencers.map((u: any) => u.id)

        const { data: socialAccounts } = await supabase
          .from('social_accounts')
          .select('user_id, follower_count, engagement_rate')
          .in('user_id', userIds)
          .eq('platform', 'instagram')

        const { data: userBadges } = await supabase
          .from('user_badges')
          .select('user_id, badge_id')
          .in('user_id', userIds)

        const socialMap = new Map<string, { follower_count: number | null; engagement_rate: number | null }>()
        socialAccounts?.forEach((sa: any) => socialMap.set(sa.user_id, sa))

        const badgeMap = new Map<string, string[]>()
        userBadges?.forEach((ub: any) => {
          if (!badgeMap.has(ub.user_id)) badgeMap.set(ub.user_id, [])
          badgeMap.get(ub.user_id)!.push(ub.badge_id)
        })

        spotlightInfluencers = influencers.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          username: u.username,
          category: u.category,
          city: u.city,
          avatar_url: u.avatar_url,
          spotlight_active: u.spotlight_active ?? false,
          follower_count: socialMap.get(u.id)?.follower_count ?? null,
          engagement_rate: socialMap.get(u.id)?.engagement_rate ?? null,
          has_verified_badge: badgeMap.get(u.id)?.includes('verified-account') ?? false,
        } satisfies SpotlightInfluencer))
      } else {
        console.log('[Home] No influencers found with current filters')
      }
    }
  } catch (err) {
    console.error('[Home] Failed to fetch spotlight influencers:', err)
  }


  return (
    <main className="relative min-h-screen w-full overflow-x-hidden">
      <div className="grid-overlay" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-soft-gold/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-80 h-72 w-72 -translate-x-1/2 rounded-full bg-[#1F2030]/80 blur-[140px]"
      />

      <div className="relative">
        <Hero />
        {/* Influencer showcase — right after Hero so visitors see real users immediately */}
        {spotlightInfluencers.length > 0 && (
          <Spotlight influencers={spotlightInfluencers} />
        )}
        <FeaturesSection />
        <DetailedStatsSection />
        <VerificationCTA />
        <ValueProposition />
        <FAQSection />
        <BadgesSection />
      </div>
    </main>
  )
}
