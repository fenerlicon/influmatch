'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { MessageCircle, CalendarDays, X } from 'lucide-react'
import { dismissInfluencer } from '@/app/dashboard/brand/offers/dismiss/actions'
import type { BrandOfferItem } from '@/app/dashboard/brand/offers/page'

interface BrandOffersListProps {
  initialOffers: BrandOfferItem[]
  currentUserId: string
  dismissedReceiverIds?: string[]
  hideHeader?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Yanıt Bekleniyor',
  accepted: 'Kabul Edildi',
  rejected: 'Reddedildi',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-yellow-200 border-yellow-400/60 bg-yellow-400/10',
  accepted: 'text-emerald-200 border-emerald-400/60 bg-emerald-400/10',
  rejected: 'text-red-200 border-red-400/60 bg-red-400/10',
}

const formatBudget = (value: number | null) => {
  if (value === null || value === undefined) return 'Belirlenmedi'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) {
    return 'Bugün'
  } else if (diffInDays === 1) {
    return '1 gün önce'
  } else if (diffInDays < 7) {
    return `${diffInDays} gün önce`
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7)
    return `${weeks} hafta önce`
  } else {
    const months = Math.floor(diffInDays / 30)
    return `${months} ay önce`
  }
}

export default function BrandOffersList({
  initialOffers,
  currentUserId,
  dismissedReceiverIds = [],
  hideHeader = false,
}: BrandOffersListProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [offers, setOffers] = useState<BrandOfferItem[]>(initialOffers)
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set(dismissedReceiverIds))
  const [selectedGroup, setSelectedGroup] = useState<{
    receiver: BrandOfferItem['receiver']
    offers: BrandOfferItem[]
    latestOffer: BrandOfferItem
    hasAccepted: boolean
    totalUnread: number
  } | null>(null)

  const [isDismissing, startDismissTransition] = useTransition()

  const handleDismiss = useCallback(
    (receiverId: string) => {
      if (!confirm('Bu influencer\'ı listeden kaldırmak istediğinizden emin misiniz?')) {
        return
      }

      startDismissTransition(async () => {
        const result = await dismissInfluencer(receiverId)
        if (result?.error) {
          alert(result.error)
        } else {
          setDismissedIds((prev) => new Set(prev).add(receiverId))
        }
      })
    },
    [],
  )

  // Group offers by receiver (influencer) to show unique users
  const groupedOffers = useMemo(() => {
    const grouped = new Map<string, {
      receiver: BrandOfferItem['receiver']
      offers: BrandOfferItem[]
      latestOffer: BrandOfferItem
      hasAccepted: boolean
      totalUnread: number
    }>()

    offers.forEach((offer) => {
      const receiverId = offer.receiver?.id
      if (!receiverId) return
      
      // Filter out dismissed influencers
      if (dismissedIds.has(receiverId)) return

      const existing = grouped.get(receiverId)
      if (existing) {
        existing.offers.push(offer)
        // Update latest offer if this one is newer
        if (new Date(offer.created_at) > new Date(existing.latestOffer.created_at)) {
          existing.latestOffer = offer
        }
        // Update hasAccepted if any offer is accepted
        if (offer.status === 'accepted') {
          existing.hasAccepted = true
        }
        // Sum unread counts
        if (offer.room_id && unreadCounts.has(offer.room_id)) {
          existing.totalUnread += unreadCounts.get(offer.room_id) ?? 0
        }
      } else {
        grouped.set(receiverId, {
          receiver: offer.receiver,
          offers: [offer],
          latestOffer: offer,
          hasAccepted: offer.status === 'accepted',
          totalUnread: offer.room_id ? (unreadCounts.get(offer.room_id) ?? 0) : 0,
        })
      }
    })

    return Array.from(grouped.values()).sort((a, b) => 
      new Date(b.latestOffer.created_at).getTime() - new Date(a.latestOffer.created_at).getTime()
    )
  }, [offers, unreadCounts, dismissedIds])


  // Calculate unread count for a specific room (only messages from other party that current user hasn't seen)
  const calculateUnreadCount = useCallback(
    async (roomId: string) => {
      if (!currentUserId || !roomId) return 0

      try {
        // Get all messages in the room
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id, sender_id')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })

        if (messagesError || !messages || messages.length === 0) {
          return 0
        }

        // Filter only messages from the other party (not from current user)
        const otherPartyMessages = messages.filter((m) => m.sender_id !== currentUserId)
        if (otherPartyMessages.length === 0) {
          return 0
        }

        // Get read receipts for current user for these messages
        const messageIds = otherPartyMessages.map((m) => m.id)
        const { data: readReceipts, error: readError } = await supabase
          .from('message_reads')
          .select('message_id')
          .in('message_id', messageIds)
          .eq('user_id', currentUserId)

        if (readError) {
          console.error('Error fetching read receipts:', readError)
          return 0
        }

        const readMessageIds = new Set(readReceipts?.map((r) => r.message_id) ?? [])

        // Count only unread messages from the other party
        const unreadCount = otherPartyMessages.filter((m) => !readMessageIds.has(m.id)).length

        return unreadCount
      } catch (error) {
        console.error('Error calculating unread count:', error)
        return 0
      }
    },
    [supabase, currentUserId],
  )

  // Fetch offer by ID with all related data
  const fetchOfferById = useCallback(
    async (offerId: string) => {
      const { data: offer } = await supabase
        .from('offers')
        .select(
          `id, campaign_name, campaign_type, budget, message, status, created_at,
          receiver:receiver_user_id(id, full_name, avatar_url, username)`,
        )
        .eq('id', offerId)
        .single()

      if (!offer) {
        return null
      }

      const { data: room } = await supabase.from('rooms').select('id').eq('offer_id', offerId).maybeSingle()

      return {
        ...(offer as BrandOfferItem),
        room_id: room?.id ?? null,
      }
    },
    [supabase],
  )

  // Real-time subscription for offers (INSERT, UPDATE, DELETE)
  useEffect(() => {
    const channel = supabase
      .channel(`brand-offers-realtime-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'offers',
          filter: `sender_user_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            setOffers((prev) => {
              const filtered = prev.filter((offer) => offer.id !== fresh.id)
              return [fresh, ...filtered].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              )
            })
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'offers',
          filter: `sender_user_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            setOffers((prev) =>
              prev.map((offer) => (offer.id === fresh.id ? fresh : offer)).sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              ),
            )
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'offers',
          filter: `sender_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          setOffers((prev) => prev.filter((offer) => offer.id !== (payload.old.id as string)))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rooms',
        },
        async (payload) => {
          const offerId = payload.new.offer_id as string | null
          if (offerId) {
            // Update room_id for the offer
            setOffers((prev) =>
              prev.map((offer) =>
                offer.id === offerId ? { ...offer, room_id: payload.new.id as string } : offer,
              ),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, supabase, fetchOfferById])

  // Fetch unread message counts for all rooms (only messages that haven't been replied to)
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      const roomIds = offers.filter((o) => o.room_id && o.status === 'accepted').map((o) => o.room_id!)
      if (roomIds.length === 0) return

      const counts = new Map<string, number>()
      await Promise.all(
        roomIds.map(async (roomId) => {
          const unreadCount = await calculateUnreadCount(roomId)
          if (unreadCount > 0) {
            counts.set(roomId, unreadCount)
          }
        }),
      )
      setUnreadCounts(counts)
    }

    fetchUnreadCounts()
  }, [offers, calculateUnreadCount])

  // Set up real-time subscriptions for all rooms
  useEffect(() => {
    const roomIds = offers.filter((o) => o.room_id && o.status === 'accepted').map((o) => o.room_id!)
    if (roomIds.length === 0) return

    const channels = roomIds.map((roomId) => {
      const channel = supabase
        .channel(`room-messages-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            // Only count messages from the other party
            if (payload.new.sender_id !== currentUserId) {
              // Recalculate unread count after a short delay to ensure message is in DB
              setTimeout(async () => {
                const unreadCount = await calculateUnreadCount(roomId)
                setUnreadCounts((prev) => {
                  const next = new Map(prev)
                  if (unreadCount > 0) {
                    next.set(roomId, unreadCount)
                  } else {
                    next.delete(roomId)
                  }
                  return next
                })
              }, 100)
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reads',
            filter: `user_id=eq.${currentUserId}`,
          },
          async () => {
            // Recalculate unread count when read receipts change for current user
            const unreadCount = await calculateUnreadCount(roomId)
            setUnreadCounts((prev) => {
              const next = new Map(prev)
              if (unreadCount > 0) {
                next.set(roomId, unreadCount)
              } else {
                next.delete(roomId)
              }
              return next
            })
          },
        )
        .subscribe()

      return channel
    })

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel)
      })
    }
  }, [offers, supabase, calculateUnreadCount, currentUserId])

  const handleOpenChat = useCallback(
    async (offer: BrandOfferItem) => {
      setChatLoadingId(offer.id)
      try {
        // Get receiver user ID
        const receiverId = offer.receiver?.id
        if (!receiverId) {
          console.error('Receiver ID not found')
          return
        }

        // Navigate to messages page with participant ID
        router.push(`/dashboard/messages?userId=${receiverId}`)
      } finally {
        setChatLoadingId(null)
      }
    },
    [router],
  )

  if (offers.length === 0) {
    return (
      <div className="space-y-6">
        {!hideHeader && (
          <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Gönderilen Teklifler</p>
            <h1 className="mt-2 text-2xl font-semibold">İşbirliği Teklifleriniz</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">
              Influencerlara gönderdiğiniz tekliflerin durumunu buradan takip edebilirsiniz.
            </p>
          </header>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
          <p className="text-lg font-semibold text-white">Henüz bir teklif göndermediniz.</p>
          <p className="mt-2 text-sm text-gray-400">
            Keşfet sayfasına gidip ilk işbirliğinizi başlatın!
          </p>
          <Link
            href="/dashboard/brand/discover"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/15 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/25"
          >
            Keşfet Sayfasına Git
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Gönderilen Teklifler</p>
          <h1 className="mt-2 text-2xl font-semibold">İşbirliği Teklifleriniz</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-300">
            Influencerlara gönderdiğiniz tekliflerin durumunu buradan takip edebilirsiniz.
          </p>
        </header>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groupedOffers.map((group) => {
          const receiver = group.receiver
          const latestOffer = group.latestOffer
          const offerCount = group.offers.length

          return (
            <article
              key={receiver?.id ?? 'unknown'}
              className="group relative rounded-3xl border border-white/10 bg-[#0B0C10] p-5 text-white transition duration-300 ease-out hover:-translate-y-1 hover:border-soft-gold/70 hover:shadow-glow"
            >
              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => receiver?.id && handleDismiss(receiver.id)}
                disabled={isDismissing}
                className="absolute right-3 top-3 z-10 rounded-full border border-white/20 bg-black/60 backdrop-blur-sm p-1.5 text-white transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Listeden Kaldır"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header: Influencer Avatar + Name */}
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5 flex-shrink-0">
                  {receiver?.avatar_url ? (
                    <Image
                      src={receiver.avatar_url}
                      alt={receiver.full_name ?? 'Influencer'}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-soft-gold">
                      {receiver?.full_name?.[0] ?? 'I'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {receiver?.full_name ?? 'Influencer'}
                  </p>
                  {receiver?.username && (
                    <p className="text-xs text-gray-400 truncate">@{receiver.username}</p>
                  )}
                  {offerCount > 1 && (
                    <p className="text-xs text-gray-500 mt-0.5">{offerCount} teklif</p>
                  )}
                </div>
              </div>

              {/* Body: Latest Campaign Info */}
              <div className="mt-4 space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-white line-clamp-2">
                    {latestOffer.campaign_name ?? 'İsimsiz Kampanya'}
                  </h3>
                  {latestOffer.campaign_type && (
                    <span className="mt-1 inline-block rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-300">
                      {latestOffer.campaign_type}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Bütçe</p>
                    <p className="mt-1 text-sm font-semibold text-soft-gold">
                      {formatBudget(latestOffer.budget)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer: Date + Status + Action */}
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{formatRelativeTime(latestOffer.created_at)}</span>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                      STATUS_STYLES[latestOffer.status] ?? 'border-white/15 text-gray-400'
                    }`}
                  >
                    {STATUS_LABELS[latestOffer.status] ?? latestOffer.status}
                  </span>
                </div>

                {group.offers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(group)}
                    className="w-full rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2.5 text-xs font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
                  >
                    Detayları Gör
                  </button>
                )}
                {group.hasAccepted && (
                  <button
                    type="button"
                    onClick={() => handleOpenChat(latestOffer)}
                    disabled={chatLoadingId === latestOffer.id}
                    className="relative w-full rounded-2xl border border-emerald-400/60 bg-emerald-400/10 px-4 py-2.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {chatLoadingId === latestOffer.id ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent" />
                        Açılıyor...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-3.5 w-3.5" />
                        Sohbete Git
                        {group.totalUnread > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg">
                            {group.totalUnread > 9 ? '9+' : group.totalUnread}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* Details Modal */}
      {selectedGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedGroup(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] rounded-3xl border border-white/10 bg-[#0B0C10] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5 flex-shrink-0">
                  {selectedGroup.receiver?.avatar_url ? (
                    <Image
                      src={selectedGroup.receiver.avatar_url}
                      alt={selectedGroup.receiver.full_name ?? 'Influencer'}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-soft-gold">
                      {selectedGroup.receiver?.full_name?.[0] ?? 'I'}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {selectedGroup.receiver?.full_name ?? 'Influencer'}
                  </h2>
                  {selectedGroup.receiver?.username && (
                    <p className="text-sm text-gray-400">@{selectedGroup.receiver.username}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{selectedGroup.offers.length} teklif</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="rounded-full border border-white/20 bg-white/5 p-2 text-white transition hover:border-white/40 hover:bg-white/10"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content - Offers List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedGroup.offers
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-2xl border border-white/10 bg-[#0F1014] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-white">
                            {offer.campaign_name ?? 'İsimsiz Kampanya'}
                          </h3>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
                              STATUS_STYLES[offer.status] ?? 'border-white/15 text-gray-400'
                            }`}
                          >
                            {STATUS_LABELS[offer.status] ?? offer.status}
                          </span>
                        </div>

                        {offer.campaign_type && (
                          <span className="inline-block rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-300 mb-3">
                            {offer.campaign_type}
                          </span>
                        )}

                        <div className="grid gap-4 md:grid-cols-2 mt-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Bütçe</p>
                            <p className="mt-1 text-base font-semibold text-soft-gold">
                              {formatBudget(offer.budget)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Tarih</p>
                            <p className="mt-1 text-sm text-gray-300">
                              {new Date(offer.created_at).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatRelativeTime(offer.created_at)}
                            </p>
                          </div>
                        </div>

                        {offer.message && (
                          <div className="mt-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">Mesaj</p>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{offer.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Footer - Chat Button */}
            {selectedGroup.hasAccepted && (
              <div className="p-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenChat(selectedGroup.latestOffer)
                    setSelectedGroup(null)
                  }}
                  disabled={chatLoadingId === selectedGroup.latestOffer.id}
                  className="relative w-full rounded-2xl border border-emerald-400/60 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {chatLoadingId === selectedGroup.latestOffer.id ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent" />
                      Açılıyor...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4" />
                      Sohbete Git
                      {selectedGroup.totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg">
                          {selectedGroup.totalUnread > 9 ? '9+' : selectedGroup.totalUnread}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

