'use client'

import OfferActionButtons from '@/components/dashboard/OfferActionButtons'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-yellow-400/50 bg-yellow-400/10 text-yellow-200',
  accepted: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
  rejected: 'border-red-400/50 bg-red-400/10 text-red-200',
}

const formatBudget = (value: number | null) => {
  if (value === null || value === undefined) return 'Belirlenmedi'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value)
}

export interface OfferListItem {
  id: string
  campaign_name: string | null
  campaign_type: string | null
  budget: number | null
  message: string | null
  status: string
  created_at: string
  room_id?: string | null
  sender: {
    id: string
    full_name: string | null
    avatar_url: string | null
    email: string | null
    social_links: Record<string, string | null> | null
  } | null
}

interface InfluencerOffersFeedProps {
  initialOffers: OfferListItem[]
  currentUserId: string
}

export default function InfluencerOffersFeed({ initialOffers, currentUserId }: InfluencerOffersFeedProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [offers, setOffers] = useState<OfferListItem[]>(initialOffers)
  const [isEmptyFallback, setIsEmptyFallback] = useState(initialOffers.length === 0)
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null)
  const [dismissedOfferIds, setDismissedOfferIds] = useState<Set<string>>(new Set())

  const fetchOfferById = useCallback(
    async (offerId: string) => {
      const { data: offer } = await supabase
        .from('offers')
        .select(
          `id, campaign_name, campaign_type, budget, message, status, created_at,
          sender:sender_user_id(id, full_name, avatar_url, email, social_links)`,
        )
        .eq('id', offerId)
        .single()
      if (!offer) {
        return null
      }
      const { data: room } = await supabase.from('rooms').select('id').eq('offer_id', offerId).maybeSingle()
      return {
        ...(offer as OfferListItem),
        room_id: room?.id ?? null,
      }
    },
    [supabase],
  )

  useEffect(() => {
    const channel = supabase
      .channel(`offers-feed-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'offers', filter: `receiver_user_id=eq.${currentUserId}` },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            setOffers((prev) => {
              const filtered = prev.filter((offer) => offer.id !== fresh.id)
              return [fresh, ...filtered]
            })
            setIsEmptyFallback(false)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'offers', filter: `receiver_user_id=eq.${currentUserId}` },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            setOffers((prev) => prev.map((offer) => (offer.id === fresh.id ? fresh : offer)))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, fetchOfferById, supabase])

  const handleStatusChange = useCallback((offerId: string, nextStatus: 'accepted' | 'rejected', meta?: { roomId?: string | null }) => {
    setOffers((prev) =>
      prev.map((offer) =>
        offer.id === offerId
          ? {
              ...offer,
              status: nextStatus,
              room_id: meta?.roomId ?? offer.room_id,
            }
          : offer,
      ),
    )
    if (nextStatus === 'rejected') {
      setIsEmptyFallback(false)
    }
  }, [])

  const fetchRoomId = useCallback(
    async (offerId: string) => {
      const { data, error } = await supabase.from('rooms').select('id').eq('offer_id', offerId).maybeSingle()
      if (error) {
        console.error('fetchRoomId error', error.message)
      }
      return data?.id ?? null
    },
    [supabase],
  )

  const handleOpenChat = useCallback(
    async (offer: OfferListItem) => {
      setChatLoadingId(offer.id)
      try {
        // Get sender user ID
        const senderId = offer.sender?.id
        if (!senderId) {
          console.error('Sender ID not found')
          return
        }

        // Check if room exists
        let roomId = offer.room_id ?? (await fetchRoomId(offer.id))
        
        // If no room exists, we'll let the messages page create it
        // Navigate to messages page with participant ID
        router.push(`/dashboard/messages?userId=${senderId}`)
      } finally {
        setChatLoadingId(null)
      }
    },
    [fetchRoomId, router],
  )

  const handleDismissRejected = useCallback((offerId: string) => {
    setDismissedOfferIds((prev) => {
      const next = new Set(prev)
      next.add(offerId)
      return next
    })
  }, [])

  const visibleOffers = useMemo(
    () => offers.filter((offer) => !dismissedOfferIds.has(offer.id)),
    [dismissedOfferIds, offers],
  )

  if (offers.length === 0 && isEmptyFallback) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
        Henüz teklif yok. Spotlight performansını artırarak markalardan daha fazla teklif alabilirsin.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleOffers.map((offer) => {
        const sender = offer.sender
        const socialLinks = (sender?.social_links as Record<string, string> | null) ?? null
        const website = socialLinks?.website ?? socialLinks?.site ?? null
        const showContact = offer.status === 'accepted'
        const isAccepted = offer.status === 'accepted'
        const isRejected = offer.status === 'rejected'

        return (
          <article
            key={offer.id}
            className="relative flex flex-col gap-5 rounded-3xl border border-white/10 bg-[#0E0F15] p-5 text-white shadow-glow-sm lg:flex-row lg:items-center lg:justify-between"
          >
            {isRejected ? (
              <button
                type="button"
                onClick={() => handleDismissRejected(offer.id)}
                className="absolute right-4 top-4 text-gray-500 transition hover:text-white"
                aria-label="Teklifi listeden kaldır"
              >
                ×
              </button>
            ) : null}
            <div className="flex flex-1 items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {sender?.avatar_url ? (
                  <Image src={sender.avatar_url} alt={sender.full_name ?? 'Marka'} fill sizes="64px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-soft-gold">
                    {sender?.full_name?.[0] ?? 'M'}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Kampanya</p>
                <h3 className="text-lg font-semibold">{offer.campaign_name ?? 'İsimsiz kampanya'}</h3>
                <p className="text-sm text-gray-400">{sender?.full_name ?? 'Marka'}</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 text-sm text-gray-300">
              <p className="line-clamp-2 text-gray-200">{offer.message || 'Brief mesajı paylaşılmamış.'}</p>
              <p className="font-semibold text-white">Bütçe: {formatBudget(offer.budget)}</p>
            </div>

            <div className="flex flex-col items-end gap-3">
              {!isAccepted ? (
                <span
                  className={`rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                    STATUS_STYLES[offer.status] ?? 'border-white/20 text-white'
                  }`}
                >
                  {offer.status}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenChat(offer)}
                  disabled={chatLoadingId === offer.id}
                  className="rounded-2xl border border-soft-gold/60 bg-soft-gold/15 px-4 py-2 text-xs font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/25 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {chatLoadingId === offer.id ? 'Açılıyor...' : 'Mesaj Gönder'}
                </button>
              )}

              {offer.status === 'pending' ? (
                <OfferActionButtons offerId={offer.id} onStatusChange={handleStatusChange} />
              ) : null}

              {isRejected ? (
                <span className="text-xs text-gray-400">Bu teklif reddedildi.</span>
              ) : null}
            </div>

            {showContact ? (
              <div className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100 lg:w-auto">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">İletişim</p>
                {sender?.email && <p className="mt-2 break-all">{sender.email}</p>}
                {website && (
                  <a href={website} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center text-emerald-200 underline-offset-4 hover:underline">
                    Website
                  </a>
                )}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

