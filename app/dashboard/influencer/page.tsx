import Link from 'next/link'
import { redirect } from 'next/navigation'
import OfferActivityCard from '@/components/dashboard/OfferActivityCard'
import ProfileCompletionCard from '@/components/dashboard/ProfileCompletionCard'
import SpotlightToggleCard from '@/components/dashboard/SpotlightToggleCard'
import InstagramConnect from '@/components/dashboard/InstagramConnect'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import type { ProfileRecord } from '@/utils/profileCompletion'
import { calculateProfileCompletion } from '@/utils/profileCompletion'
import InfluencerStats from '@/components/profile/InfluencerStats'
import VerificationWarningCard from '@/components/dashboard/VerificationWarningCard'
import { getFavoriteCount } from '@/app/actions/favorites'
import TrustScoreCard from '@/components/dashboard/TrustScoreCard'
import { calculateTrustScore } from '@/utils/matching'

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
    .select('spotlight_active, is_showcase_visible, full_name, username, city, bio, category, avatar_url, social_links, verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[InfluencerDashboardPage] profile load error', error.message)
  }

  // Fetch social account stats
  const { data: socialAccount } = await supabase
    .from('social_accounts')
    .select('username, follower_count, engagement_rate, stats_payload, updated_at, has_stats')
    .eq('user_id', user.id)
    .eq('platform', 'instagram')
    .single()

  const rawSpotlightActive = profile?.spotlight_active ?? false
  const isShowcaseVisible = profile?.is_showcase_visible ?? true // Default to true if null
  const verificationStatus = profile?.verification_status ?? 'pending'

  // Spotlight is active if user is verified AND spotlight_active is true
  const spotlightActive = rawSpotlightActive && verificationStatus === 'verified'

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

  const stats = [
    {
      label: 'Profil Doluluk',
      value: `${profileCompletion.percent}%`,
      badge: isProfileComplete ? 'Tamamlandı' : `${Math.max(profileCompletion.total - profileCompletion.completed, 0)} görev`,
      variant: isProfileComplete ? 'complete' : null,
    },
    {
      label: 'Sizi Favorileyen Marka Sayısı',
      value: spotlightActive ? `${favoriteCount}` : null,
      badge: spotlightActive ? 'Markalar sizi takip ediyor' : 'Vitrine çıkarak markalara ulaş',
      variant: null,
      action: !spotlightActive ? (
        <a href="/dashboard/spotlight" className="inline-block rounded-lg bg-soft-gold/20 px-3 py-1 text-xs font-semibold text-soft-gold hover:bg-soft-gold/30 transition">
          Spotlight'ı Aç
        </a>
      ) : null
    },
    {
      label: 'Bekleyen Teklif',
      value: `${pendingOffersCount}`,
      badge: 'Cevap bekleyen',
    },
    {
      label: 'Spotlight Durumu',
      value: spotlightActive ? 'Aktif' : 'Pasif',
      badge: spotlightActive ? 'Vitrine çıkıldı' : 'Kapalı',
      variant: spotlightActive ? 'spotlight-active' : null,
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
          {stats.map((item) => (
            <div
              key={item.label}
              className={`relative overflow-hidden rounded-2xl border p-4 text-sm ${item.variant === 'complete'
                ? 'border-white/15 bg-gradient-to-br from-[#1a1b23] to-[#101118] text-gray-200'
                : item.variant === 'spotlight-active'
                  ? 'border-soft-gold/60 bg-gradient-to-br from-soft-gold/20 to-soft-gold/5 text-gray-200 shadow-[0_0_22px_rgba(212,175,55,0.3)]'
                  : 'border-white/10 bg-[#11121A] text-gray-300'
                }`}
            >
              {item.variant === 'complete' ? (
                <>
                  <span className="pointer-events-none absolute inset-0 bg-white/5 opacity-30" />
                  <span
                    className="pointer-events-none absolute inset-0 opacity-15"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(135deg, rgba(212,175,55,0.15) 0, rgba(212,175,55,0.15) 2px, transparent 2px, transparent 12px)',
                    }}
                  />
                </>
              ) : item.variant === 'spotlight-active' ? (
                <>
                  <span className="pointer-events-none absolute inset-0 bg-soft-gold/10 opacity-50" />
                  <span
                    className="pointer-events-none absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(135deg, rgba(212,175,55,0.3) 0, rgba(212,175,55,0.3) 2px, transparent 2px, transparent 12px)',
                    }}
                  />
                </>
              ) : null}
              <div className="relative z-10">
                <p>{item.label}</p>
                {item.action ? (
                  <div className="mt-2 min-h-[32px] flex items-center">{item.action}</div>
                ) : (
                  <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                )}
                <p
                  className={`mt-4 text-xs uppercase tracking-[0.3em] ${item.variant === 'spotlight-active'
                    ? 'font-bold text-soft-gold text-sm tracking-[0.4em]'
                    : 'text-soft-gold'
                    }`}
                >
                  {item.badge}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats & Analysis Section - Influencer View */}
      {/* Stats & Analysis Section - Influencer View */}
      {!(socialAccount && socialAccount.has_stats && !showProfileCompletionCard) && socialAccount && socialAccount.has_stats ? (
        <InfluencerStats
          followerCount={socialAccount.follower_count || 0}
          engagementRate={Number(socialAccount.engagement_rate) || 0}
          statsPayload={socialAccount.stats_payload as any}
          lastUpdated={socialAccount.updated_at}
          mode="influencer-view"
        />
      ) : !socialAccount?.has_stats ? (
        <VerificationWarningCard />
      ) : null}

      <SpotlightToggleCard
        initialActive={isShowcaseVisible}
        verificationStatus={verificationStatus}
      />

      {/* Instagram Verification Component */}
      <div id="verification-section" className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h3 className="text-lg font-semibold text-white mb-4">Hesap Doğrulama</h3>
        <InstagramConnect
          userId={user.id}
          isVerified={!!socialAccount?.has_stats}
          initialUsername={socialAccount?.username}
          lastUpdated={socialAccount?.updated_at}
        />
      </div>

      {/* Feedback CTA */}
      <section className="rounded-3xl border border-orange-500/30 bg-orange-500/10 p-6 shadow-glow">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Bu bir MVP sürümüdür</h3>
            <p className="mt-1 text-sm text-gray-300">
              Hata ve geribildirimlerinizi bizimle paylaşın. Görüşleriniz bizim için çok değerli!
            </p>
          </div>
          <Link
            href="/feedback"
            className="rounded-2xl border border-orange-400/60 bg-orange-500/20 px-6 py-3 text-sm font-semibold text-orange-200 transition hover:border-orange-400 hover:bg-orange-500/30 whitespace-nowrap"
          >
            Geri Bildirim Gönder
          </Link>
        </div>
      </section>

      <section className={`grid gap-6 ${showProfileCompletionCard ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {showProfileCompletionCard ? (
          <>
            <div className="lg:col-span-2 space-y-6">
              <ProfileCompletionCard userId={user.id} initialProfile={profileData} />
              {/* Trust Score Card for Profile Incomplete Users */}
              <TrustScoreCard
                score={calculateTrustScore({
                  id: user.id,
                  full_name: profile?.full_name ?? null,
                  username: profile?.username ?? null,
                  avatar_url: profile?.avatar_url ?? null,
                  verification_status: verificationStatus as any,
                  category: profile?.category ?? null,
                  spotlight_active: rawSpotlightActive,
                  stats: socialAccount ? {
                    followers: socialAccount.follower_count?.toString() || '0',
                    engagement: (Number(socialAccount.engagement_rate) || 0) + '%',
                    avg_comments: (socialAccount.stats_payload as any)?.avg_comments?.toString()
                  } : undefined
                })}
              />
            </div>
            <OfferActivityCard userId={user.id} initialOffers={filteredOffers} dismissedOfferIds={dismissedOfferIds} />
          </>
        ) : (
          <>
            <div className="space-y-6">
              {/* Trust Score Card for Complete Users */}
              <TrustScoreCard
                score={calculateTrustScore({
                  id: user.id,
                  full_name: profile?.full_name ?? null,
                  username: profile?.username ?? null,
                  avatar_url: profile?.avatar_url ?? null,
                  verification_status: verificationStatus as any,
                  category: profile?.category ?? null,
                  spotlight_active: rawSpotlightActive,
                  stats: socialAccount ? {
                    followers: socialAccount.follower_count?.toString() || '0',
                    engagement: (Number(socialAccount.engagement_rate) || 0) + '%',
                    avg_comments: (socialAccount.stats_payload as any)?.avg_comments?.toString()
                  } : undefined
                })}
              />
              {socialAccount && socialAccount.has_stats ? (
                <InfluencerStats
                  followerCount={socialAccount.follower_count || 0}
                  engagementRate={Number(socialAccount.engagement_rate) || 0}
                  statsPayload={socialAccount.stats_payload as any}
                  lastUpdated={socialAccount.updated_at}
                  mode="influencer-view"
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
