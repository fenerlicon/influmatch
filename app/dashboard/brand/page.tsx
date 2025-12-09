import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import BrandPipelineCard from '@/components/dashboard/BrandPipelineCard'
import BrandVerificationCard from '@/components/dashboard/BrandVerificationCard'
import ProfileCompletionCard from '@/components/dashboard/ProfileCompletionCard'
import BrandOffersList from '@/components/dashboard/BrandOffersList'
import type { ProfileRecord } from '@/utils/profileCompletion'
import type { BrandOfferItem } from '@/app/dashboard/brand/offers/page'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import InfluencerGridCard from '@/components/dashboard/InfluencerGridCard'
import type { DiscoverInfluencer } from '@/types/influencer'
import { calculateMatchScore, getMatchReason } from '@/utils/matching'
import { Sparkles, Layers, Lock } from 'lucide-react'
import InflistCard from '@/components/dashboard/InflistCard'

export default async function BrandDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get profile data for completion card
  const { data: profile } = await supabase
    .from('users')
    .select('verification_status, full_name, username, city, bio, category, avatar_url, social_links, spotlight_active')
    .eq('id', user.id)
    .maybeSingle()

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

  // Get initial offer counts
  const { data: offerStatuses } = await supabase
    .from('offers')
    .select('status')
    .eq('sender_user_id', user.id)

  const pendingOffersCount = offerStatuses?.filter((row) => row.status === 'pending').length ?? 0
  const acceptedOffersCount = offerStatuses?.filter((row) => row.status === 'accepted').length ?? 0

  // Fetch offers for campaign flow list
  const { data: offers, error: offersError } = await supabase
    .from('offers')
    .select(
      `id, campaign_name, campaign_type, budget, message, status, created_at,
      receiver:receiver_user_id(id, full_name, avatar_url, username, verification_status)`,
    )
    .eq('sender_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10) // Limit to 10 most recent offers for home page

  if (offersError) {
    console.error('[BrandDashboardPage] offers load error', offersError.message)
  }

  let offersWithRoom: BrandOfferItem[] = (offers as unknown as BrandOfferItem[]) ?? []

  // Fetch room IDs for accepted offers
  if (offersWithRoom.length > 0) {
    const offerIds = offersWithRoom.map((offer) => offer.id)
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, offer_id')
      .in('offer_id', offerIds)

    if (roomsError) {
      console.error('[BrandDashboardPage] rooms load error', roomsError.message)
    } else if (rooms) {
      const roomMap = new Map<string, string>()
      rooms.forEach((room) => {
        if (room.offer_id) {
          roomMap.set(room.offer_id, room.id)
        }
      })
      offersWithRoom = offersWithRoom.map((offer) => ({
        ...offer,
        room_id: roomMap.get(offer.id) ?? null,
      }))
    }
  }

  // Fetch dismissed influencers
  const { data: dismissedOffers, error: dismissedError } = await supabase
    .from('dismissed_offers')
    .select('receiver_user_id')
    .eq('user_id', user.id)

  if (dismissedError) {
    console.error('[BrandDashboardPage] dismissed offers load error', dismissedError.message)
  }

  const dismissedReceiverIds = new Set(dismissedOffers?.map((d) => d.receiver_user_id) ?? [])


  // Fetch All Favorite IDs for checking status
  const { data: allFavorites } = await supabase
    .from('favorites')
    .select('influencer_id')
    .eq('brand_id', user.id)

  const favoritedSet = new Set(allFavorites?.map((f: any) => f.influencer_id) ?? [])

  // Fetch Recent Favorites (for display)
  const { data: recentFavs } = await supabase
    .from('favorites')
    .select('influencer_id')
    .eq('brand_id', user.id)
    .order('created_at', { ascending: false })
    .limit(4)

  // Fetch User Lists (Inflist)
  const { data: userLists } = await supabase
    .from('favorite_lists')
    .select('id, name')
    .eq('brand_id', user.id)
    .order('created_at', { ascending: false })

  let favoriteInfluencers: DiscoverInfluencer[] = []
  if (recentFavs && recentFavs.length > 0) {
    const ids = recentFavs.map((f: any) => f.influencer_id)
    favoriteInfluencers = await getEnrichedInfluencers({ ids })
    // Re-sort to match recent order (getEnrichedInfluencers sorts by spotlight/name)
    favoriteInfluencers.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  }

  // Fetch AI Recommendations
  const allInfluencers = await getEnrichedInfluencers({ limit: 50 })
  const recommendations = allInfluencers
    .map(influencer => {
      const score = calculateMatchScore(influencer, { targetCategory: profileData.category || undefined })
      const reasons = getMatchReason(influencer, { targetCategory: profileData.category || undefined })
      return { ...influencer, matchScore: score, matchReasons: reasons }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4)

  const userRole = user.user_metadata?.role || 'brand'
  const isSpotlight = profile?.spotlight_active || false

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#15161F] to-[#0C0D10] p-6 shadow-glow">

        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Marka Paneli</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Yeni kampanyanı başlat</h1>
        <p className="mt-2 max-w-2xl text-gray-300">
          Briefini tamamla, filtreli keşif ile doğru influencer’ları listele ve tek tıkla teklif gönder.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/brand/discover"
            className="rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-6 py-3 text-sm font-semibold text-soft-gold shadow-[0_0_25px_rgba(212,175,55,0.35)] transition hover:border-soft-gold hover:bg-soft-gold/20"
          >
            Keşfet
          </Link>
          <Link
            href="/dashboard/brand/advert?tab=mine"
            className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30"
          >
            Brief Hazırla
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <BrandPipelineCard
          userId={user.id}
          initialPendingCount={pendingOffersCount}
          initialAcceptedCount={acceptedOffersCount}
        />

        <ProfileCompletionCard userId={user.id} initialProfile={profileData} role="brand" />
      </section>

      {/* Recent Favorites Section */}
      {favoriteInfluencers.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Favoriler</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Son Eklenenler</h2>
            </div>
            <Link
              href="/dashboard/brand/favorites"
              className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              Tümünü (Detaylı) Gör
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {favoriteInfluencers.map(influencer => (
              <div key={influencer.id} className="h-full">
                <InfluencerGridCard influencer={influencer} initialIsFavorited={true} userRole={userRole} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inflist (User Lists) Section */}
      {userLists && userLists.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-[#12131A] p-6 shadow-glow relative overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">Influencer Listelerin</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Inflist</h2>
            </div>
            {isSpotlight && (
              <Link
                href="/dashboard/brand/favorites"
                className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                Tümünü Yönet
              </Link>
            )}
          </div>
          <div className="relative">
            <div className={`grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 ${!isSpotlight ? 'blur-md pointer-events-none select-none opacity-50' : ''}`}>
              {userLists.map((list: any) => (
                <InflistCard key={list.id} list={list} />
              ))}
            </div>

            {!isSpotlight && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-500 mb-3 border border-cyan-500/30">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Inflist'e Özel Erişim</h3>
                <p className="text-xs text-gray-400 mt-1 mb-4 max-w-[200px]">Listelerinizi yönetmek için Spotlight ayrıcalıklarına sahip olun.</p>
                <Link href="/dashboard/spotlight/brand" className="text-xs font-bold text-cyan-500 hover:text-cyan-400 transition-colors uppercase tracking-wider border-b border-cyan-500/30 pb-0.5 hover:border-cyan-500">
                  Spotlight'a Geç
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* AI Recommendations Section */}
      {recommendations.length > 0 && (
        <section className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
            <Sparkles className="h-32 w-32 text-blue-500" />
          </div>
          <div className="mb-6 flex items-center justify-between relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 mb-2 rounded-full border border-blue-500/30 bg-blue-500/20 px-3 py-1">
                <Sparkles className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">AI Powered</span>
              </div>
              <h2 className="text-xl font-semibold text-white">Sizin İçin Önerilenler</h2>
              <p className="text-sm text-gray-400 mt-1">Marka profilinize ve hedeflerinize en uygun influencer'lar.</p>
            </div>
            {isSpotlight && (
              <Link
                href="/dashboard/brand/discover?sort=recommended"
                className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20 hover:text-white"
              >
                Tümünü Gör
              </Link>
            )}
          </div>

          <div className="relative z-10">
            <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 relative ${!isSpotlight ? 'blur-md pointer-events-none select-none opacity-50' : ''}`}>
              {recommendations.map(influencer => (
                <div key={influencer.id} className="h-full">
                  <InfluencerGridCard
                    influencer={influencer}
                    initialIsFavorited={favoritedSet.has(influencer.id)}
                    userRole={userRole}
                    matchScore={influencer.matchScore}
                    matchReasons={influencer.matchReasons}
                  />
                </div>
              ))}
            </div>

            {!isSpotlight && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 mb-4 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                  <Lock className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Spotlight İle Kilidi Aç</h3>
                <p className="text-sm text-gray-400 mt-2 mb-6 max-w-sm">Yapay zeka destekli önerileri görmek ve en doğru eşleşmeleri yakalamak için Spotlight'a geçin.</p>
                <Link href="/dashboard/spotlight/brand" className="px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition shadow-lg shadow-blue-900/20">
                  Spotlight Satın Al
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ... */}

      {/* Campaign Flow List */}
      {offersWithRoom.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Kampanya Akışı</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Son Teklifler</h2>
            </div>
            <Link
              href="/dashboard/brand/offers"
              className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              Tümünü Gör
            </Link>
          </div>
          <BrandOffersList
            initialOffers={offersWithRoom}
            currentUserId={user.id}
            dismissedReceiverIds={Array.from(dismissedReceiverIds)}
            hideHeader={true}
          />
        </section>
      )}

      {/* Verification Guide Card */}
      <BrandVerificationCard userId={user.id} initialVerificationStatus={verificationStatus} />

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
    </div>
  )
}
