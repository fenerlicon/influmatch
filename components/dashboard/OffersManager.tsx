'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Inbox, MessageSquare, X } from 'lucide-react'
import OfferActionButtons from '@/components/dashboard/OfferActionButtons'
import OfferCampaignBrief from '@/components/campaigns/OfferCampaignBrief'
import { dismissOffer } from '@/app/dashboard/influencer/offers/dismiss/actions'
import { Avatar, Button, ButtonLink, Card, Chip, ConfirmDialog, EmptyState, Eyebrow, Segmented, VerifiedTick, type ChipTone } from '@/components/ui'
import { cn } from '@/utils/cn'
import { countUnreadInRoom } from '@/lib/unread-messages'
import { OFFER_EXPIRY_DAYS, effectiveOfferStatus } from '@/lib/offer-shared'

export interface OfferListItem {
  id: string
  campaign_name: string | null
  campaign_type: string | null
  budget: number | null
  payment_type?: 'cash' | 'barter' | null
  message: string | null
  status: string
  created_at: string
  /** Marka bekleyen teklifi düzenlediyse (2026-10-14). */
  edited_at?: string | null
  /** Kampanya daveti (3.19): brief ayrıntıda sunucudan yüklenir. */
  campaign_id?: string | null
  room_id?: string | null
  sender: {
    id: string
    full_name: string | null
    avatar_url: string | null
    email?: string | null
    username?: string | null
    social_links: Record<string, string | null> | null
    verification_status?: string | null
    role?: string | null
    displayed_badges?: string[] | null
  } | null
}

interface OffersManagerProps {
  initialOffers: OfferListItem[]
  currentUserId: string
  dismissedOfferIds?: Set<string>
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Cevap bekleniyor',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
  expired: 'Süresi doldu',
  withdrawn: 'Marka geri çekti',
}

const STATUS_TONES: Record<string, ChipTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  withdrawn: 'neutral',
}

/** İşlem dışı kalan teklifler: süresi dolan ve markanın geri çektiği ('Düşen' filtresinde görünür). */
const isClosedOffer = (status: string) => status === 'expired' || status === 'withdrawn'

const daysLeft = (createdAt: string) => Math.max(0, OFFER_EXPIRY_DAYS - Math.floor((Date.now() - Date.parse(createdAt)) / 86_400_000))

type StatusFilter = 'all' | 'pending' | 'accepted' | 'rejected' | 'expired'

const formatBudget = (value: number | null) => {
  if (value === null || value === undefined) return 'Belirlenmedi'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function OffersManager({ initialOffers, currentUserId, dismissedOfferIds = new Set() }: OffersManagerProps) {
  const supabase = useSupabaseClient()
  const [offers, setOffers] = useState<OfferListItem[]>(initialOffers)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(initialOffers[0]?.id ?? null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(dismissedOfferIds)
  // Marka e-postası sadece kabul edilmiş tekliflerde, DB fonksiyonu üzerinden alınır.
  const [contactEmails, setContactEmails] = useState<Record<string, string | null>>({})
  const [isPending, startTransition] = useTransition()
  const [dismissTarget, setDismissTarget] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Update offers when initialOffers changes (e.g., after page refresh)
  useEffect(() => {
    const filtered = initialOffers.filter((o) => !dismissedIds.has(o.id))
    setOffers(filtered)
    setSelectedOfferId((prev) => {
      if (prev && filtered.some((o) => o.id === prev)) {
        return prev
      }
      return filtered[0]?.id ?? null
    })
  }, [initialOffers, dismissedIds])

  // "Tümü" süresi dolan ve geri çekilen teklifleri göstermez; onlar "Düşen" filtresinde.
  const filterOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'pending', label: 'Bekleyen' },
    { value: 'accepted', label: 'Kabul' },
    { value: 'rejected', label: 'Red' },
    { value: 'expired', label: 'Düşen' },
  ]

  const fetchOfferById = useCallback(
    async (offerId: string) => {
      const { data: offer } = await supabase
        .from('offers')
        .select(
          `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at, edited_at, campaign_id,
        sender:sender_user_id(id, full_name, avatar_url, username, social_links, displayed_badges)`,
        )
        .eq('id', offerId)
        .single()

      if (!offer) {
        return null
      }

      const { data: room } = await supabase.from('rooms').select('id').eq('offer_id', offerId).maybeSingle()

      return {
        ...(offer as unknown as OfferListItem),
        room_id: room?.id ?? null,
      }
    },
    [supabase],
  )

  useEffect(() => {
    const channel = supabase
      .channel(`offers-board-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'offers', filter: `receiver_user_id=eq.${currentUserId}` },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            // Check if this offer was dismissed
            const { data: dismissed } = await supabase
              .from('dismissed_offers')
              .select('id')
              .eq('user_id', currentUserId)
              .eq('offer_id', fresh.id)
              .maybeSingle()

            if (!dismissed) {
              // Only add if not dismissed
              setOffers((prev) => {
                const filtered = prev.filter((offer) => offer.id !== fresh.id)
                return [fresh, ...filtered]
              })
              setSelectedOfferId((prev) => prev ?? fresh.id)
            } else {
              // Add to dismissed list
              setDismissedIds((prev) => {
                const next = new Set(prev)
                next.add(fresh.id)
                return next
              })
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'offers', filter: `receiver_user_id=eq.${currentUserId}` },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            // Check if this offer was dismissed
            const { data: dismissed } = await supabase
              .from('dismissed_offers')
              .select('id')
              .eq('user_id', currentUserId)
              .eq('offer_id', fresh.id)
              .maybeSingle()

            if (dismissed) {
              // Offer was dismissed, remove from list
              setDismissedIds((prev) => {
                const next = new Set(prev)
                next.add(fresh.id)
                return next
              })
              setOffers((prev) => prev.filter((offer) => offer.id !== fresh.id))
              setSelectedOfferId((prev) => (prev === fresh.id ? null : prev))
            } else {
              // Offer was not dismissed, update it (only if not in dismissed list)
              setDismissedIds((prev) => {
                if (prev.has(fresh.id)) {
                  const next = new Set(prev)
                  next.delete(fresh.id)
                  return next
                }
                return prev
              })
              setOffers((prev) => {
                const exists = prev.some((offer) => offer.id === fresh.id)
                if (exists) {
                  return prev.map((offer) => (offer.id === fresh.id ? fresh : offer))
                } else {
                  // Add if it doesn't exist and wasn't dismissed
                  return [fresh, ...prev]
                }
              })
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dismissed_offers', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const offerId = payload.new.offer_id as string | null
          if (offerId) {
            setDismissedIds((prev) => {
              const next = new Set(prev)
              next.add(offerId)
              return next
            })
            setOffers((prev) => prev.filter((offer) => offer.id !== offerId))
            setSelectedOfferId((prev) => (prev === offerId ? null : prev))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'dismissed_offers', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const offerId = payload.old.offer_id as string | null
          if (offerId) {
            setDismissedIds((prev) => {
              const next = new Set(prev)
              next.delete(offerId)
              return next
            })
            // Optionally, re-fetch the offer if it was undismissed
            // For now, we'll just remove it from dismissed list
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, fetchOfferById, supabase])

  // Keep offers state clean - always filter out dismissed offers
  useEffect(() => {
    setOffers((prev) => prev.filter((offer) => !dismissedIds.has(offer.id)))
  }, [dismissedIds])

  const filteredOffers = useMemo(() => {
    // Offers state should already be filtered, but double-check
    const notDismissed = offers.filter((offer) => !dismissedIds.has(offer.id))
    if (statusFilter === 'all') return notDismissed.filter((offer) => !isClosedOffer(effectiveOfferStatus(offer)))
    if (statusFilter === 'expired') return notDismissed.filter((offer) => isClosedOffer(effectiveOfferStatus(offer)))
    return notDismissed.filter((offer) => effectiveOfferStatus(offer) === statusFilter)
  }, [offers, statusFilter, dismissedIds])

  useEffect(() => {
    if (!selectedOfferId && filteredOffers.length > 0) {
      setSelectedOfferId(filteredOffers[0].id)
      return
    }
    if (selectedOfferId && !filteredOffers.some((offer) => offer.id === selectedOfferId)) {
      setSelectedOfferId(filteredOffers[0]?.id ?? null)
    }
  }, [filteredOffers, selectedOfferId])

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === selectedOfferId) ?? null,
    [offers, selectedOfferId],
  )

  useEffect(() => {
    if (!selectedOffer || selectedOffer.status !== 'accepted' || selectedOffer.id in contactEmails) return
    const offerId = selectedOffer.id
    supabase
      .rpc('get_offer_contact_email', { p_offer_id: offerId })
      .then(({ data, error }) => {
        if (error) console.error('[OffersManager] contact load error', error.message)
        setContactEmails((prev) => ({ ...prev, [offerId]: (data as string | null) ?? null }))
      })
  }, [selectedOffer, contactEmails, supabase])

  const handleStatusChange = useCallback(
    (offerId: string, nextStatus: 'accepted' | 'rejected' | 'hold', meta?: { roomId?: string | null }) => {
      setOffers((prev) =>
        prev.map((offer) =>
          offer.id === offerId
            ? {
              ...offer,
              status: nextStatus === 'hold' ? 'pending' : nextStatus,
              room_id: meta?.roomId ?? offer.room_id,
            }
            : offer,
        ),
      )
    },
    [],
  )

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

  // Kabul edilmiş tekliflerin sohbet odaları. Efektler bu listeye bağlıdır; böylece bir teklifi
  // gizlemek ya da seçmek oda kanallarını yeniden açmaz.
  const acceptedRoomKey = useMemo(
    () => offers.filter((o) => o.room_id && o.status === 'accepted').map((o) => o.room_id!).join(','),
    [offers],
  )

  // Fetch unread message counts for all rooms (only messages that haven't been replied to)
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      const roomIds = acceptedRoomKey ? acceptedRoomKey.split(',') : []
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
  }, [acceptedRoomKey, calculateUnreadCount])

  // Set up real-time subscriptions for all rooms
  useEffect(() => {
    const roomIds = acceptedRoomKey ? acceptedRoomKey.split(',') : []
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
  }, [acceptedRoomKey, supabase, calculateUnreadCount, currentUserId])

  const handleOpenChat = useCallback(
    (offer: OfferListItem, e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }

      // Teklifin kendi odası varsa doğrudan o açılır; yoksa bu kişiyle mevcut sohbet aranır.
      if (offer.room_id) {
        window.location.href = `/dashboard/messages?roomId=${offer.room_id}`
        return
      }
      const senderId = offer.sender?.id
      if (!senderId) return
      window.location.href = `/dashboard/messages?userId=${senderId}`
    },
    [],
  )

  const handleDismissOffer = useCallback(
    (offerId: string) => {
      setDismissTarget(null)

      // Optimistically update UI
      setDismissedIds((prev) => {
        const next = new Set(prev)
        next.add(offerId)
        return next
      })
      setOffers((prev) => prev.filter((o) => o.id !== offerId))
      setSelectedOfferId((prev) => (prev === offerId ? null : prev))

      startTransition(async () => {
        const result = await dismissOffer(offerId)
        if (result?.error) {
          toast.error(result.error)
          // Revert optimistic update on error
          setDismissedIds((prev) => {
            const next = new Set(prev)
            next.delete(offerId)
            return next
          })
          // Re-fetch the offer if error occurred
          const fresh = await fetchOfferById(offerId)
          if (fresh) {
            setOffers((prev) => {
              if (!prev.some((o) => o.id === offerId)) {
                return [fresh, ...prev]
              }
              return prev
            })
          }
        }
      })
    },
    [fetchOfferById],
  )

  const selectOffer = (offerId: string) => {
    setSelectedOfferId(offerId)
    // Dar ekranda detay listenin altında; seçince oraya kaydır.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  const renderListItem = (offer: OfferListItem) => {
    const sender = offer.sender
    const isActive = offer.id === selectedOfferId
    const status = effectiveOfferStatus(offer)
    return (
      <div key={offer.id} className="relative border-b border-line last:border-b-0">
        <button
          type="button"
          onClick={() => selectOffer(offer.id)}
          aria-current={isActive ? 'true' : undefined}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3 pr-11 text-left transition-colors',
            isActive ? 'bg-surface-2 shadow-[inset_2px_0_0_theme(colors.gold.DEFAULT)]' : 'hover:bg-white/[0.015]',
          )}
        >
          <Avatar name={sender?.full_name} src={sender?.avatar_url} square />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium text-ink">{offer.campaign_name ?? 'İsimsiz kampanya'}</div>
            <div className="flex items-center gap-1 truncate text-xs text-ink-faint">
              {sender?.full_name ?? 'Marka'}
              {sender?.displayed_badges?.includes('official-business') && <VerifiedTick tone="gold" label="Resmi işletme" />}
              <span>· {new Date(offer.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
              {offer.edited_at && <span>· düzenlendi</span>}
            </div>
          </div>
          <Chip tone={STATUS_TONES[status] ?? 'neutral'} dot>
            {status === 'pending' ? `${daysLeft(offer.created_at)} gün kaldı` : STATUS_LABELS[status] ?? offer.status}
          </Chip>
        </button>
        <button
          type="button"
          onClick={() => setDismissTarget(offer.id)}
          disabled={isPending}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-faint opacity-60 transition hover:bg-surface-3 hover:text-ink hover:opacity-100 disabled:opacity-30"
          aria-label="Teklifi listeden kaldır"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const renderDetail = () => {
    if (!selectedOffer) {
      return (
        <Card>
          <EmptyState icon={Inbox} title="Teklif seçin" description="Listeden bir teklif seçtiğinde ayrıntıları burada görünür." />
        </Card>
      )
    }

    const sender = selectedOffer.sender
    const socialLinks = (sender?.social_links as Record<string, string> | null) ?? null
    const website = socialLinks?.website ?? socialLinks?.site ?? null
    const showContact = selectedOffer.status === 'accepted'
    const contactEmail = contactEmails[selectedOffer.id] ?? null
    const status = effectiveOfferStatus(selectedOffer)
    const unread = selectedOffer.room_id ? unreadCounts.get(selectedOffer.room_id) ?? 0 : 0
    const canChat = selectedOffer.status === 'accepted' || (status === 'pending' && !!selectedOffer.room_id)

    return (
      <Card as="section">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={sender?.full_name} src={sender?.avatar_url} size="lg" square />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <span className="truncate">{sender?.full_name ?? 'Marka'}</span>
                {sender?.displayed_badges?.includes('official-business') && <VerifiedTick tone="gold" label="Resmi işletme" />}
              </div>
              {sender?.username ? (
                <Link href={`/profile/${sender.username}`} className="text-[12.5px] text-ink-faint hover:text-ink">
                  @{sender.username}
                </Link>
              ) : null}
            </div>
          </div>
          <Chip tone={STATUS_TONES[status] ?? 'neutral'} dot>
            {STATUS_LABELS[status] ?? selectedOffer.status}
          </Chip>
        </div>

        <div className="border-t border-line p-5">
          <h2 className="text-[19px] font-semibold tracking-tight text-ink">{selectedOffer.campaign_name ?? 'İsimsiz kampanya'}</h2>
          <dl className="mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
            {selectedOffer.campaign_type && (
              <>
                <dt className="text-ink-faint">Tür</dt>
                <dd className="text-ink">{selectedOffer.campaign_type}</dd>
              </>
            )}
            <dt className="text-ink-faint">{selectedOffer.payment_type === 'barter' ? 'Barter (ürün)' : 'Bütçe (nakit)'}</dt>
            <dd className="tabular-nums text-ink">{formatBudget(selectedOffer.budget)}</dd>
            <dt className="text-ink-faint">Gönderildi</dt>
            <dd className="text-ink">{new Date(selectedOffer.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</dd>
            {selectedOffer.edited_at && (
              <>
                <dt className="text-ink-faint">Düzenlendi</dt>
                <dd className="text-ink">
                  {new Date(selectedOffer.edited_at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
                </dd>
              </>
            )}
          </dl>
        </div>

        <div className="border-t border-line p-5">
          <Eyebrow>Marka briefi</Eyebrow>
          <p className="mt-2 whitespace-pre-line text-[13.5px] text-ink-muted">{selectedOffer.message || 'Marka bu teklif için ayrıntı paylaşmadı.'}</p>
        </div>

        {selectedOffer.campaign_id && (
          <div className="border-t border-line p-5">
            <OfferCampaignBrief key={selectedOffer.id} offerId={selectedOffer.id} />
          </div>
        )}

        <div className="border-t border-line p-5">
          <Eyebrow>İletişim</Eyebrow>
          {showContact ? (
            <div className="mt-2 grid gap-1 text-[13.5px]">
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="text-gold underline-offset-4 hover:underline">
                  {contactEmail}
                </a>
              ) : (
                <p className="text-ink-faint">E-posta belirtilmemiş.</p>
              )}
              {website ? (
                <a href={website} target="_blank" rel="noreferrer" className="text-gold underline-offset-4 hover:underline">
                  Web sitesi
                </a>
              ) : (
                <p className="text-ink-faint">Web sitesi paylaşılmadı.</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-ink-faint">Markanın iletişim bilgileri teklifi kabul ettiğinde açılır.</p>
          )}
        </div>

        {(status === 'pending' || isClosedOffer(status) || canChat) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
            {status === 'expired' && <span className="text-xs text-ink-faint">{OFFER_EXPIRY_DAYS} gün içinde yanıtlanmadığı için artık yanıtlanamaz.</span>}
            {status === 'withdrawn' && <span className="text-xs text-ink-faint">Marka teklifi geri çekti. Bu teklif artık yanıtlanamaz.</span>}
            {canChat && (
              <Button size="sm" leftIcon={<MessageSquare />} onClick={(e) => handleOpenChat(selectedOffer, e)}>
                Sohbete git
                {unread > 0 && (
                  <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[11px] font-semibold text-gold-ink">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Button>
            )}
            {status === 'pending' && (
              <div className="ml-auto">
                <OfferActionButtons offerId={selectedOffer.id} editedAt={selectedOffer.edited_at ?? null} onStatusChange={handleStatusChange} />
              </div>
            )}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto border-b border-line p-3 [scrollbar-width:none]">
          <Segmented label="Teklif durumu" value={statusFilter} onSelect={(v) => setStatusFilter(v as StatusFilter)} items={filterOptions} />
        </div>
        {filteredOffers.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={offers.length === 0 ? 'Henüz teklif yok' : 'Bu filtrede teklif yok'}
            description={offers.length === 0 ? 'Markalar sana teklif gönderdiğinde burada görünür. Bu arada ilanlara başvurabilirsin.' : undefined}
            action={
              offers.length === 0 ? (
                <ButtonLink href="/dashboard/influencer/advert" size="sm">
                  İlanlara göz at
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <div>{filteredOffers.map(renderListItem)}</div>
        )}
      </Card>
      <div ref={detailRef} className="scroll-mt-20">
        {renderDetail()}
      </div>
      <ConfirmDialog
        open={dismissTarget !== null}
        onClose={() => setDismissTarget(null)}
        onConfirm={() => dismissTarget && handleDismissOffer(dismissTarget)}
        title="Teklifi listeden kaldır"
        description="Teklif yalnızca senin listenden gizlenir."
        confirmLabel="Kaldır"
        tone="danger"
      />
    </div>
  )
}
