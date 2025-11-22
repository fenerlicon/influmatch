import { redirect } from 'next/navigation'
import OffersManager from '@/components/dashboard/OffersManager'
import type { OfferListItem } from '@/components/dashboard/InfluencerOffersFeed'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import type { UserRole } from '@/types/auth'

export default async function DashboardOffersPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = (user.user_metadata?.role ?? 'influencer') as UserRole

  if (role !== 'influencer') {
    redirect('/dashboard/brand/offers')
  }

  const { data: offers, error } = await supabase
    .from('offers')
    .select(
      `id, campaign_name, campaign_type, budget, message, status, created_at,
      sender:sender_user_id(id, full_name, avatar_url, email, social_links)`,
    )
    .eq('receiver_user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[DashboardOffersPage] load error', error.message)
  }

  let offersWithRoom: OfferListItem[] = (offers as OfferListItem[]) ?? []

  if (offersWithRoom.length > 0) {
    const offerIds = offersWithRoom.map((offer) => offer.id)
    const { data: rooms, error: roomsError } = await supabase.from('rooms').select('id, offer_id').in('offer_id', offerIds)

    if (roomsError) {
      console.error('[DashboardOffersPage] rooms load error', roomsError.message)
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

  // Fetch dismissed offers for this influencer
  const { data: dismissedOffers, error: dismissedError } = await supabase
    .from('dismissed_offers')
    .select('offer_id')
    .eq('user_id', user.id)
    .not('offer_id', 'is', null)

  if (dismissedError) {
    console.error('[DashboardOffersPage] dismissed offers load error', dismissedError.message)
  }

  const dismissedOfferIds = new Set(dismissedOffers?.map((d) => d.offer_id).filter(Boolean) ?? [])

  // Filter out dismissed offers from initial offers
  const filteredOffers = offersWithRoom.filter((offer) => !dismissedOfferIds.has(offer.id))

  return <OffersManager initialOffers={filteredOffers} currentUserId={user.id} dismissedOfferIds={dismissedOfferIds} />
}


