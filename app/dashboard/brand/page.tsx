import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import BrandPipelineCard from '@/components/dashboard/BrandPipelineCard'
import BrandVerificationCard from '@/components/dashboard/BrandVerificationCard'
import ProfileCompletionCard from '@/components/dashboard/ProfileCompletionCard'
import BrandOffersList from '@/components/dashboard/BrandOffersList'
import type { ProfileRecord } from '@/utils/profileCompletion'
import type { BrandOfferItem } from '@/app/dashboard/brand/offers/page'

const quickStats = [
  { label: 'Aylık Bütçe', value: 'yakında' },
  { label: 'Etkileşim Ort.', value: 'yakında' },
  { label: 'Aktif Kampanya', value: 'yakında' },
]

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
    .select('verification_status, full_name, username, city, bio, category, avatar_url, social_links')
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
      receiver:receiver_user_id(id, full_name, avatar_url, username)`,
    )
    .eq('sender_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10) // Limit to 10 most recent offers for home page

  if (offersError) {
    console.error('[BrandDashboardPage] offers load error', offersError.message)
  }

  let offersWithRoom: BrandOfferItem[] = (offers as BrandOfferItem[]) ?? []

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
            Vitrin'e Git
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

