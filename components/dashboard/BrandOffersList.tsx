'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MessageSquare, Send, X } from 'lucide-react'
import { dismissInfluencer } from '@/app/dashboard/brand/offers/dismiss/actions'
import type { BrandOfferItem } from '@/lib/works'
import { countUnreadInRoom } from '@/lib/unread-messages'
import { OFFER_EXPIRY_DAYS, effectiveOfferStatus } from '@/lib/offer-shared'
import { Avatar, Button, ButtonLink, Card, Chip, ConfirmDialog, EmptyState, ListRow, Modal, VerifiedTick, type ChipTone } from '@/components/ui'

interface BrandOffersListProps {
  initialOffers: BrandOfferItem[]
  currentUserId: string
  dismissedReceiverIds?: string[]
  hideHeader?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Yanıt bekleniyor',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
  expired: 'Süresi doldu',
}

const STATUS_TONES: Record<string, ChipTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
}

const daysLeft = (createdAt: string) => Math.max(0, OFFER_EXPIRY_DAYS - Math.floor((Date.now() - Date.parse(createdAt)) / 86_400_000))

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
  const [dismissTarget, setDismissTarget] = useState<string | null>(null)

  const handleDismiss = useCallback(
    (receiverId: string) => {
      startDismissTransition(async () => {
        const result = await dismissInfluencer(receiverId)
        setDismissTarget(null)
        if (result?.error) {
          toast.error(result.error)
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
        return await countUnreadInRoom(supabase, roomId, currentUserId)
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
          `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at,
          receiver:receiver_user_id(id, full_name, avatar_url, username, displayed_badges)`,
        )
        .eq('id', offerId)
        .single()

      if (!offer) {
        return null
      }

      const { data: room } = await supabase.from('rooms').select('id').eq('offer_id', offerId).maybeSingle()

      return {
        ...(offer as unknown as BrandOfferItem),
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
          filter: `brand_id=eq.${currentUserId}`,
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
        // Teklifin kendi odası varsa doğrudan o açılır; yoksa bu kişiyle mevcut sohbet aranır.
        if (offer.room_id) {
          router.push(`/dashboard/messages?roomId=${offer.room_id}`)
          return
        }
        const receiverId = offer.receiver?.id
        if (!receiverId) return
        router.push(`/dashboard/messages?userId=${receiverId}`)
      } finally {
        setChatLoadingId(null)
      }
    },
    [router],
  )

  if (groupedOffers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Send}
          title="Henüz teklif göndermedin"
          description="Keşfet'ten uygun profilleri bulup ilk teklifini gönder."
          action={
            <ButtonLink href="/dashboard/brand/discover" variant="primary" size="sm">
              Keşfete git
            </ButtonLink>
          }
        />
      </Card>
    )
  }

  return (
    <>
      <Card className="overflow-hidden">
        {groupedOffers.map((group) => {
          const receiver = group.receiver
          const latestOffer = group.latestOffer
          const status = effectiveOfferStatus(latestOffer)
          return (
            <ListRow key={receiver?.id ?? latestOffer.id}>
              <Avatar name={receiver?.full_name} src={receiver?.avatar_url} />
              <div className="min-w-0 flex-[1_1_200px]">
                <div className="flex items-center gap-1 truncate text-[13.5px] font-medium text-ink">
                  <span className="truncate">{latestOffer.campaign_name ?? 'İsimsiz kampanya'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-1 text-xs text-ink-faint">
                  {receiver?.username ? (
                    <Link href={`/profile/${receiver.username}`} className="hover:text-ink">
                      {receiver.full_name ?? `@${receiver.username}`}
                    </Link>
                  ) : (
                    <span>{receiver?.full_name ?? 'Influencer'}</span>
                  )}
                  {receiver?.displayed_badges?.includes('verified-account') && <VerifiedTick />}
                  <span>
                    · {latestOffer.payment_type === 'barter' ? 'Barter' : formatBudget(latestOffer.budget)} · {formatRelativeTime(latestOffer.created_at)}
                  </span>
                  {group.offers.length > 1 && <span>· {group.offers.length} teklif</span>}
                </div>
              </div>
              <Chip tone={STATUS_TONES[status] ?? 'neutral'} dot>
                {status === 'pending' ? `${daysLeft(latestOffer.created_at)} gün içinde düşer` : STATUS_LABELS[status] ?? latestOffer.status}
              </Chip>
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(group)}>
                  Ayrıntı
                </Button>
                {group.hasAccepted && (
                  <Button size="sm" leftIcon={<MessageSquare />} loading={chatLoadingId === latestOffer.id} onClick={() => handleOpenChat(latestOffer)}>
                    Sohbet
                    {group.totalUnread > 0 && (
                      <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[11px] font-semibold text-gold-ink">
                        {group.totalUnread > 9 ? '9+' : group.totalUnread}
                      </span>
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Listeden kaldır"
                  disabled={isDismissing}
                  onClick={() => receiver?.id && setDismissTarget(receiver.id)}
                >
                  <X />
                </Button>
              </div>
            </ListRow>
          )
        })}
      </Card>

      <Modal
        open={selectedGroup !== null}
        onClose={() => setSelectedGroup(null)}
        size="lg"
        title={selectedGroup?.receiver?.full_name ?? 'Influencer'}
        description={selectedGroup ? `${selectedGroup.receiver?.username ? `@${selectedGroup.receiver.username} · ` : ''}${selectedGroup.offers.length} teklif` : undefined}
        footer={
          selectedGroup?.hasAccepted ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<MessageSquare />}
              onClick={() => {
                if (!selectedGroup) return
                handleOpenChat(selectedGroup.latestOffer)
                setSelectedGroup(null)
              }}
            >
              Sohbete git
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-3">
          {[...(selectedGroup?.offers ?? [])]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((offer) => {
              const status = effectiveOfferStatus(offer)
              return (
                <div key={offer.id} className="rounded-xl border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-ink">{offer.campaign_name ?? 'İsimsiz kampanya'}</div>
                    <Chip tone={STATUS_TONES[status] ?? 'neutral'} dot>
                      {STATUS_LABELS[status] ?? offer.status}
                    </Chip>
                  </div>
                  <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[13px]">
                    {offer.campaign_type && (
                      <>
                        <dt className="text-ink-faint">Tür</dt>
                        <dd className="text-ink">{offer.campaign_type}</dd>
                      </>
                    )}
                    <dt className="text-ink-faint">{offer.payment_type === 'barter' ? 'Barter (ürün)' : 'Bütçe (nakit)'}</dt>
                    <dd className="tabular-nums text-ink">{formatBudget(offer.budget)}</dd>
                    <dt className="text-ink-faint">Tarih</dt>
                    <dd className="text-ink">
                      {new Date(offer.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </dd>
                  </dl>
                  {offer.message && <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-muted">{offer.message}</p>}
                </div>
              )
            })}
        </div>
      </Modal>

      <ConfirmDialog
        open={dismissTarget !== null}
        onClose={() => setDismissTarget(null)}
        onConfirm={() => dismissTarget && handleDismiss(dismissTarget)}
        title="Listeden kaldır"
        description="Bu influencer'a gönderdiğin teklifler yalnızca senin listenden gizlenir."
        confirmLabel="Kaldır"
        tone="danger"
        loading={isDismissing}
      />
    </>
  )
}
