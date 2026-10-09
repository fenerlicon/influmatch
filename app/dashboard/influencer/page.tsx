import Link from 'next/link'
import { redirect } from 'next/navigation'
import OfferActivityCard from '@/components/dashboard/OfferActivityCard'
import ProfileCompletionCard from '@/components/dashboard/ProfileCompletionCard'
import SpotlightToggleCard from '@/components/dashboard/SpotlightToggleCard'
import InstagramConnect from '@/components/dashboard/InstagramConnect'
import TikTokConnect from '@/components/dashboard/TikTokConnect'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import type { ProfileRecord } from '@/utils/profileCompletion'
import { calculateProfileCompletion } from '@/utils/profileCompletion'
import InfluencerStats from '@/components/profile/InfluencerStats'
import VerificationWarningCard from '@/components/dashboard/VerificationWarningCard'
import { getFavoriteCount } from '@/app/actions/favorites'
import TrustScoreCard from '@/components/dashboard/TrustScoreCard'
import BlueTickProgressCard from '@/components/dashboard/BlueTickProgressCard'
import { BLUE_TICK_BADGE_ID, evaluateBlueTick, type BlueTickAccount } from '@/lib/blue-tick-rules'
import { CheckCircle2, Heart, Mail, Sparkles, Calendar } from 'lucide-react'

import { refreshIfStale } from '@/lib/social-stats'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { getProfileViewStats } from '@/lib/profile-views'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import ProfileViewsCard from '@/components/dashboard/ProfileViewsCard'
import { resolveSubscriptionTier } from '@/lib/subscription-tier'
import { cookies } from 'next/headers'
import FirstStepsCard from '@/components/dashboard/FirstStepsCard'
import { getFirstStepsStatus } from '@/lib/first-steps'
import { FIRST_STEPS_HIDDEN_COOKIE } from '@/lib/first-steps-shared'

export const revalidate = 0

export default async function InfluencerDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('spotlight_active, spotlight_plan, spotlight_expires_at, is_showcase_visible, full_name, username, city, bio, category, avatar_url, social_links, verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[InfluencerDashboardPage] profile load error', error.message)
  }

  // Fetch social account stats (Instagram)
  const { data: instagramAccount } = await supabase
    .from('social_accounts')
    .select('username, follower_count, engagement_rate, stats_payload, updated_at, has_stats, is_verified, last_scraped_at')
    .eq('user_id', user.id)
    .eq('platform', 'instagram')
    .maybeSingle()

  // Fetch social account stats (TikTok)
  const { data: tiktokAccount } = await supabase
    .from('social_accounts')
    .select('username, follower_count, engagement_rate, stats_payload, updated_at, is_verified, has_stats, last_scraped_at')
    .eq('user_id', user.id)
    .eq('platform', 'tiktok')
    .maybeSingle()

  const instagramData = instagramAccount && instagramAccount.has_stats ? {
    username: instagramAccount.username,
    followerCount: instagramAccount.follower_count || 0,
    engagementRate: Number(instagramAccount.engagement_rate) || 0,
    statsPayload: instagramAccount.stats_payload as any,
    lastUpdated: instagramAccount.updated_at || new Date().toISOString()
  } : undefined

  const tiktokData = tiktokAccount && (tiktokAccount.has_stats || tiktokAccount.is_verified) ? {
    username: tiktokAccount.username,
    followerCount: tiktokAccount.follower_count || 0,
    engagementRate: Number(tiktokAccount.engagement_rate) || 0,
    statsPayload: tiktokAccount.stats_payload as any,
    lastUpdated: tiktokAccount.updated_at || new Date().toISOString()
  } : undefined

  // Mavi tik: Spotlight + performans + güven kuralı (lib/blue-tick-rules.ts)
  const blueTickEvaluation = evaluateBlueTick(
    {
      id: user.id,
      full_name: profile?.full_name ?? null,
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
      category: profile?.category ?? null,
      spotlight_active: profile?.spotlight_active ?? false,
      spotlight_expires_at: profile?.spotlight_expires_at ?? null,
    },
    [
      ...(instagramAccount ? [{ platform: 'instagram', ...instagramAccount }] : []),
      ...(tiktokAccount ? [{ platform: 'tiktok', ...tiktokAccount }] : []),
    ] as BlueTickAccount[],
  )
  const { data: blueTickBadge } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', user.id)
    .eq('badge_id', BLUE_TICK_BADGE_ID)
    .maybeSingle()

  const isShowcaseVisible = profile?.is_showcase_visible ?? true
  const verificationStatus = profile?.verification_status ?? 'pending'
  // Süresi dolmuş plan saatlik görev kapatana kadar da aktif sayılmaz.
  const spotlightActive = hasActiveSpotlight(profile) && verificationStatus === 'verified'

  // Görüntülenme sayıları yalnızca Spotlight üyesine okunur ve gönderilir.
  const adminClient = spotlightActive ? createSupabaseAdminClient() : null
  const profileViewStats = adminClient ? await getProfileViewStats(adminClient, user.id) : null

  if (user && profile?.username) {
    refreshIfStale(user.id, 'instagram').catch((err: any) => console.error('AutoRefresh Instagram Error:', err))
    if (tiktokAccount) {
      refreshIfStale(user.id, 'tiktok').catch((err: any) => console.error('AutoRefresh TikTok Error:', err))
    }
  }

  const userTier = resolveSubscriptionTier({ ...profile, role: 'influencer' })

  // "İlk adımlar": kullanıcı gizlediyse hiç hesaplanmaz.
  const firstStepsHidden = cookies().get(FIRST_STEPS_HIDDEN_COOKIE)?.value === user.id
  const firstSteps = firstStepsHidden ? null : await getFirstStepsStatus(supabase, user.id)


  const profileData: ProfileRecord = {
    full_name: profile?.full_name ?? null,
    username: profile?.username ?? null,
    city: profile?.city ?? null,
    bio: profile?.bio ?? null,
    category: profile?.category ?? null,
    avatar_url: profile?.avatar_url ?? null,
    social_links: (profile?.social_links as Record<string, string | null> | null) ?? null,
  }

  const profileCompletion = calculateProfileCompletion(profileData)
  const isProfileComplete = profileCompletion.percent >= 100
  // Güven skoru kartı mavi tik kuralıyla aynı hesabı ve aynı skoru gösterir (2.4-S1).
  const trustScoreDetails = {
    spotlightActive: blueTickEvaluation.spotlightActive,
    hasConnectedAccount: blueTickEvaluation.primaryPlatform !== null,
    profileComplete: isProfileComplete,
    engagementRate: blueTickEvaluation.primaryEngagementRate,
  }
  const showProfileCompletionCard = !isProfileComplete

  const { data: recentOffers, error: offerError } = await supabase
    .from('offers')
    .select(`id, campaign_name, status, budget, created_at, sender:sender_user_id(full_name)`)
    .eq('receiver_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10) // Get more to filter dismissed ones

  if (offerError) {
    console.error('[InfluencerDashboardPage] offer feed error', offerError.message)
  }

  // Fetch dismissed offers for this influencer
  const { data: dismissedOffers, error: dismissedError } = await supabase
    .from('dismissed_offers')
    .select('offer_id')
    .eq('user_id', user.id)
    .not('offer_id', 'is', null)

  if (dismissedError) {
    console.error('[InfluencerDashboardPage] dismissed offers load error', dismissedError.message)
  }

  const dismissedOfferIds = new Set(dismissedOffers?.map((d) => d.offer_id).filter(Boolean) ?? [])

  // Filter out dismissed offers and limit to 5
  const filteredOffers = (recentOffers ?? [])
    .filter((offer) => !dismissedOfferIds.has(offer.id))
    .slice(0, 5)
    .map((offer) => ({
      ...offer,
      sender: Array.isArray(offer.sender) ? offer.sender[0] : offer.sender,
    }))

  const { data: offerStatuses, error: offerStatusError } = await supabase
    .from('offers')
    .select('status')
    .eq('receiver_user_id', user.id)

  if (offerStatusError) {
    console.error('[InfluencerDashboardPage] offer stats error', offerStatusError.message)
  }

  const pendingOffersCount = offerStatuses?.filter((row) => row.status === 'pending').length ?? 0

  // Get favorite count
  const favoriteCount = await getFavoriteCount(user.id)

  const spotlightExpiresAt = profile?.spotlight_expires_at ? new Date(profile.spotlight_expires_at) : null
  const spotlightExpiryText = spotlightExpiresAt 
    ? spotlightExpiresAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    : null

  const stats = [
    {
      label: 'Profil Doluluk',
      value: `${profileCompletion.percent}%`,
      badge: isProfileComplete ? 'Tamamlandı' : `${Math.max(profileCompletion.total - profileCompletion.completed, 0)} görev`,
      variant: isProfileComplete ? 'complete' : null,
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      label: 'Favorileyen Markalar',
      value: spotlightActive ? `${favoriteCount}` : '-',
      badge: spotlightActive ? 'Markalar sizi takip ediyor' : 'Vitrine çıkarak markalara ulaş',
      variant: null,
      icon: <Heart className="h-5 w-5" />,
      action: !spotlightActive ? (
        <a href="/dashboard/spotlight" className="inline-block rounded-lg bg-soft-gold/20 px-3 py-1 text-xs font-semibold text-soft-gold hover:bg-soft-gold/30 transition border border-soft-gold/30">
          Spotlight'ı Aç
        </a>
      ) : null
    },
    {
      label: 'Bekleyen Teklif',
      value: `${pendingOffersCount}`,
      badge: 'Cevap bekleyen',
      icon: <Mail className="h-5 w-5" />,
    },
    {
      label: 'Spotlight Durumu',
      value: spotlightActive ? 'Aktif' : 'Pasif',
      badge: spotlightActive ? (spotlightExpiryText ? `${spotlightExpiryText}'e kadar` : 'Vitrine çıkıldı') : 'Kapalı',
      variant: spotlightActive ? 'spotlight-active' : null,
      icon: <Sparkles className="h-5 w-5" />,
    },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Genel Bakış</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Influencer Paneli</h2>
            <p className="mt-2 text-gray-300">
              Profil gücünü artır, teklifleri yönet ve Spotlight vitrininde öne çık.
            </p>
          </div>
          <Link
            href="/dashboard/influencer/profile"
            className="rounded-2xl border border-soft-gold/50 px-5 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/10"
          >
            Profilini Güncelle
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => {
            const cardContent = (
              <div
                className={`group relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 hover:scale-[1.02] h-full ${
                  item.variant === 'complete'
                  ? 'border-green-500/30 bg-gradient-to-br from-[#1a1b23] to-[#0a0b10] shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                  : item.variant === 'spotlight-active'
                    ? 'border-soft-gold/60 bg-gradient-to-br from-soft-gold/20 to-soft-gold/5 shadow-[0_0_22px_rgba(212,175,55,0.2)]'
                    : 'border-white/10 bg-[#11121A] hover:border-white/20'
                }`}
              >
                {item.variant === 'complete' ? (
                  <>
                    <span className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-green-500/10 blur-2xl" />
                  </>
                ) : item.variant === 'spotlight-active' ? (
                  <>
                    <span className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-soft-gold/20 blur-2xl" />
                  </>
                ) : (
                  <span className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 blur-2xl transition-all group-hover:bg-white/10" />
                )}
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">{item.label}</p>
                      <div className={`rounded-xl p-2 ${
                        item.variant === 'complete' ? 'bg-green-500/20 text-green-400' :
                        item.variant === 'spotlight-active' ? 'bg-soft-gold/20 text-soft-gold' :
                        'bg-white/5 text-gray-400'
                      }`}>
                        {item.icon}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      {item.action ? (
                        <div className="min-h-[40px] flex items-center">{item.action}</div>
                      ) : (
                        <div className="flex items-baseline gap-2">
                           <p className="text-3xl font-bold text-white tracking-tight">{item.value}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`mt-4 flex items-center gap-1.5 py-1 px-3 rounded-lg w-fit ${
                    item.variant === 'complete' ? 'bg-green-500/10 text-green-400' :
                    item.variant === 'spotlight-active' ? 'bg-soft-gold/15 text-soft-gold font-semibold' :
                    'bg-white/5 text-gray-500'
                  }`}>
                    {item.variant === 'spotlight-active' && <Calendar className="h-3 w-3" />}
                    <p className="text-[10px] uppercase tracking-[0.1em]">{item.badge}</p>
                  </div>
                </div>
              </div>
            );

            if (item.label === 'Profil Doluluk') {
              return (
                <a href="#profile-completion-section" key={item.label} className="block cursor-pointer">
                  {cardContent}
                </a>
              );
            }

            return <div key={item.label}>{cardContent}</div>;
          })}
        </div>
      </section>

      {firstSteps && !firstSteps.allDone && <FirstStepsCard userId={user.id} status={firstSteps} />}

      <ProfileViewsCard stats={profileViewStats} isSpotlight={spotlightActive} />

      {/* Stats & Analysis Section - Influencer View */}
      {showProfileCompletionCard && (instagramData || tiktokData) ? (
        <InfluencerStats
          instagramData={instagramData}
          tiktokData={tiktokData}
          mode="influencer-view"
          subscriptionTier={userTier}
        />
      ) : !(instagramData || tiktokData) ? (
        <VerificationWarningCard />
      ) : null}

      <SpotlightToggleCard
        initialActive={isShowcaseVisible}
        verificationStatus={verificationStatus}
        hasConnectedAccounts={!!(instagramData || tiktokData)}
      />

      {/* Social Connections Section */}
      <div id="verification-section" className="grid gap-6 md:grid-cols-2">
        {/* Instagram Verification Component */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <InstagramConnect
            userId={user.id}
            isVerified={!!instagramAccount?.has_stats}
            initialUsername={instagramAccount?.username}
            lastUpdated={instagramAccount?.updated_at}
          />
        </div>

        {/* TikTok Verification Component */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <TikTokConnect
            userId={user.id}
            isVerified={!!tiktokAccount?.is_verified}
            username={tiktokAccount?.username}
          />
        </div>
      </div>



      <section className={`grid gap-6 ${showProfileCompletionCard ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {showProfileCompletionCard ? (
          <>
            <div id="profile-completion-section" className="lg:col-span-2 space-y-6">
              <ProfileCompletionCard userId={user.id} initialProfile={profileData} />
              {/* Trust Score Card for Profile Incomplete Users */}
              <TrustScoreCard
                score={blueTickEvaluation.trustScore}
                details={trustScoreDetails}
              />
              <BlueTickProgressCard evaluation={blueTickEvaluation} hasBlueTick={!!blueTickBadge} />
            </div>
            <OfferActivityCard userId={user.id} initialOffers={filteredOffers} dismissedOfferIds={dismissedOfferIds} />
          </>
        ) : (
          <>
            <div className="space-y-6">
              {/* Trust Score Card for Complete Users */}
              <TrustScoreCard
                score={blueTickEvaluation.trustScore}
                details={trustScoreDetails}
              />
              <BlueTickProgressCard evaluation={blueTickEvaluation} hasBlueTick={!!blueTickBadge} />
              {instagramData || tiktokData ? (
                <InfluencerStats
                  instagramData={instagramData}
                  tiktokData={tiktokData}
                  mode="influencer-view"
                  subscriptionTier={userTier}
                />
              ) : (
                <VerificationWarningCard />
              )}
            </div>
            <div className="lg:col-span-1">
              <OfferActivityCard userId={user.id} initialOffers={filteredOffers} dismissedOfferIds={dismissedOfferIds} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
