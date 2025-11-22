import { redirect } from 'next/navigation'
import BrandOffersList from '@/components/dashboard/BrandOffersList'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const revalidate = 0

export interface BrandOfferItem {
  id: string
  campaign_name: string | null
  campaign_type: string | null
  budget: number | null
  message: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  room_id?: string | null
  receiver: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
  } | null
}

export default async function BrandOffersPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch offers sent by this brand
  const { data: offers, error } = await supabase
    .from('offers')
    .select(
      `id, campaign_name, campaign_type, budget, message, status, created_at,
      receiver:receiver_user_id(id, full_name, avatar_url, username)`,
    )
    .eq('sender_user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[BrandOffersPage] load error', error.message)
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
      console.error('[BrandOffersPage] rooms load error', roomsError.message)
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
    console.error('[BrandOffersPage] dismissed offers load error', dismissedError.message)
  }

  const dismissedReceiverIds = new Set(dismissedOffers?.map((d) => d.receiver_user_id) ?? [])

  return (
    <BrandOffersList
      initialOffers={offersWithRoom}
      currentUserId={user.id}
      dismissedReceiverIds={Array.from(dismissedReceiverIds)}
    />
  )
}

