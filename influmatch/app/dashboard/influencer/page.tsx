export const revalidate = 0

import Link from 'next/link'
import { redirect } from 'next/navigation'
import OfferActivityCard from '@/components/dashboard/OfferActivityCard'
import ProfileCompletionCard from '@/components/dashboard/ProfileCompletionCard'
import SpotlightToggleCard from '@/components/dashboard/SpotlightToggleCard'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import type { ProfileRecord } from '@/utils/profileCompletion'
import { calculateProfileCompletion } from '@/utils/profileCompletion'

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
    .select('spotlight_active, full_name, username, city, bio, category, avatar_url, social_links, verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[InfluencerDashboardPage] profile load error', error.message)
  }

  const spotlightActive = profile?.spotlight_active ?? false
  const verificationStatus = profile?.verification_status ?? 'pending'

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
  const filteredOffers = (recentOffers ?? []).filter((offer) => !dismissedOfferIds.has(offer.id)).slice(0, 5)

  const { data: offerStatuses, error: offerStatusError } = await supabase
    .from('offers')
    .select('status')
    .eq('receiver_user_id', user.id)

  if (offerStatusError) {
    console.error('[InfluencerDashboardPage] offer stats error', offerStatusError.message)
  }

  const pendingOffersCount = offerStatuses?.filter((row) => row.status === 'pending').length ?? 0
  const acceptedOffersCount = offerStatuses?.filter((row) => row.status === 'accepted').length ?? 0

  const stats = [
    {
      label: 'Profil Doluluk',
      value: `${profileCompletion.percent}%`,
      badge: isProfileComplete ? 'Tamamlandı' : `${Math.max(profileCompletion.total - profileCompletion.completed, 0)} görev`,
      variant: isProfileComplete ? 'complete' : null,
    },
    {
      label: 'Aktif Kampanya',
      value: `${acceptedOffersCount}`,
      badge: 'Kabul edilen',
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
              className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#11121A] p-4 text-sm text-gray-300 ${
                item.variant === 'complete' ? 'border-white/15 bg-gradient-to-br from-[#1a1b23] to-[#101118] text-gray-200' : ''
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
              ) : null}
              <div className="relative z-10">
                <p>{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.3em] text-soft-gold">
                  {item.badge}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SpotlightToggleCard initialActive={spotlightActive} />

      {/* Verification Guide Card */}
      {verificationStatus === 'pending' && (
        <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-200">Hesap Doğrulama Kılavuzu</h3>
              <p className="mt-2 text-sm text-yellow-100/90">
                Hesabının daha hızlı onaylanması için Instagram biyografine geçici olarak{' '}
                <span className="font-semibold text-yellow-200">#Influmatch</span> yazabilirsin.
              </p>
            </div>
          </div>
        </div>
      )}

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
            <div className="lg:col-span-2">
              <ProfileCompletionCard userId={user.id} initialProfile={profileData} />
            </div>
            <OfferActivityCard userId={user.id} initialOffers={filteredOffers} dismissedOfferIds={dismissedOfferIds} />
          </>
        ) : (
          <div className="lg:col-span-2">
            <OfferActivityCard userId={user.id} initialOffers={filteredOffers} dismissedOfferIds={dismissedOfferIds} />
          </div>
        )}
      </section>
    </div>
  )
}

