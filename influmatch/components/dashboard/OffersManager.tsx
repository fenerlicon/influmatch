'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import OfferActionButtons from '@/components/dashboard/OfferActionButtons'
import type { OfferListItem } from '@/components/dashboard/InfluencerOffersFeed'
import { dismissOffer } from '@/app/dashboard/influencer/offers/dismiss/actions'
import { X } from 'lucide-react'

interface OffersManagerProps {
  initialOffers: OfferListItem[]
  currentUserId: string
  dismissedOfferIds?: Set<string>
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Cevap bekleniyor',
  accepted: 'Kabul edildi',
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

export default function OffersManager({ initialOffers, currentUserId, dismissedOfferIds = new Set() }: OffersManagerProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [offers, setOffers] = useState<OfferListItem[]>(initialOffers)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(initialOffers[0]?.id ?? null)
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(dismissedOfferIds)
  const [isPending, startTransition] = useTransition()

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

  const filterOptions: Array<{ value: 'all' | 'pending' | 'accepted' | 'rejected'; label: string }> = [
    { value: 'all', label: 'Tümü' },
    { value: 'pending', label: 'Bekleyen' },
    { value: 'accepted', label: 'Kabul edilen' },
    { value: 'rejected', label: 'Reddedilen' },
  ]

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
  }, [currentUserId, fetchOfferById, supabase, dismissedIds])

  // Keep offers state clean - always filter out dismissed offers
  useEffect(() => {
    setOffers((prev) => prev.filter((offer) => !dismissedIds.has(offer.id)))
  }, [dismissedIds])

  const filteredOffers = useMemo(() => {
    // Offers state should already be filtered, but double-check
    const notDismissed = offers.filter((offer) => !dismissedIds.has(offer.id))
    if (statusFilter === 'all') return notDismissed
    return notDismissed.filter((offer) => offer.status === statusFilter)
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

  const handleStatusChange = useCallback(
    (offerId: string, nextStatus: 'accepted' | 'rejected', meta?: { roomId?: string | null }) => {
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
    },
    [],
  )

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

  if (offers.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
        Henüz teklif yok. Spotlight vitrinini aktif tutarak markalardan gelen iş birliklerini burada yönetebilirsin.
      </div>
    )
  }

  const handleDismissOffer = useCallback(
    (offerId: string, event: React.MouseEvent) => {
      event.stopPropagation()
      if (!confirm('Bu teklifi listeden kaldırmak istediğinizden emin misiniz?')) return

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
          alert(result.error)
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

  const renderListItem = (offer: OfferListItem) => {
    const sender = offer.sender
    const isActive = offer.id === selectedOfferId
    return (
      <div key={offer.id} className="relative">
        <button
          type="button"
          onClick={() => setSelectedOfferId(offer.id)}
          className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
            isActive
              ? 'border-soft-gold/60 bg-white/5 text-white shadow-[0_0_18px_rgba(212,175,55,0.25)]'
              : 'border-white/10 bg-[#10111A] text-gray-300 hover:border-soft-gold/40 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {sender?.avatar_url ? (
                <Image src={sender.avatar_url} alt={sender.full_name ?? 'Marka'} fill sizes="48px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-soft-gold">
                  {sender?.full_name?.[0] ?? 'M'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{offer.campaign_name ?? 'İsimsiz kampanya'}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-400">{sender?.full_name ?? 'Marka'}</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                STATUS_STYLES[offer.status] ?? 'border-white/15 text-gray-400'
              }`}
            >
              {STATUS_LABELS[offer.status] ?? offer.status}
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {new Date(offer.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
          </p>
        </button>
        <button
          type="button"
          onClick={(e) => handleDismissOffer(offer.id, e)}
          disabled={isPending}
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/60 backdrop-blur-sm text-gray-400 transition hover:border-white/50 hover:bg-black/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Teklifi listeden kaldır"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const renderDetail = () => {
    if (!selectedOffer) {
      return <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">Teklif seçin.</div>
    }

    const sender = selectedOffer.sender
    const socialLinks = (sender?.social_links as Record<string, string> | null) ?? null
    const website = socialLinks?.website ?? socialLinks?.site ?? null
    const canChat = selectedOffer.status === 'accepted'
    const showContact = selectedOffer.status === 'accepted'

    return (
      <div className="flex h-full flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white/10 bg-[#0F1014]">
              {sender?.avatar_url ? (
                <Image src={sender.avatar_url} alt={sender?.full_name ?? 'Marka'} fill sizes="64px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-soft-gold">
                  {sender?.full_name?.[0] ?? 'M'}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-soft-gold">Marka</p>
              <h2 className="text-xl font-semibold text-white">{sender?.full_name ?? 'Marka'}</h2>
              <p className="text-sm text-gray-400">@{sender?.email?.split('@')[0] ?? 'unknown'}</p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <span
              className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                STATUS_STYLES[selectedOffer.status] ?? 'border-white/20 text-gray-300'
              }`}
            >
              {STATUS_LABELS[selectedOffer.status] ?? selectedOffer.status}
            </span>

            {selectedOffer.status === 'pending' ? (
              <OfferActionButtons offerId={selectedOffer.id} onStatusChange={handleStatusChange} />
            ) : null}

            {canChat ? (
              <button
                type="button"
                onClick={() => handleOpenChat(selectedOffer)}
                disabled={chatLoadingId === selectedOffer.id}
                className="relative rounded-2xl border border-soft-gold/60 bg-soft-gold/15 px-4 py-2 text-xs font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/25 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {chatLoadingId === selectedOffer.id ? (
                  'Açılıyor...'
                ) : (
                  <>
                    Mesaj Gönder
                    {selectedOffer.room_id && unreadCounts.get(selectedOffer.room_id) && unreadCounts.get(selectedOffer.room_id)! > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg">
                        {unreadCounts.get(selectedOffer.room_id)! > 9 ? '9+' : unreadCounts.get(selectedOffer.room_id)}
                      </span>
                    )}
                  </>
                )}
              </button>
            ) : null}
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#0F1014] p-5 text-sm text-gray-200">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Kampanya</p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedOffer.campaign_name ?? 'İsimsiz kampanya'}</p>
              {selectedOffer.campaign_type ? (
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{selectedOffer.campaign_type}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Bütçe</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatBudget(selectedOffer.budget)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Gönderildi</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {new Date(selectedOffer.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0F1014] p-5 text-sm text-gray-200">
          <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Marka briefi</p>
          <p className="mt-3 whitespace-pre-line text-base text-gray-100">
            {selectedOffer.message || 'Marka bu teklif için detay paylaşmadı.'}
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0F1014] p-5 text-sm text-gray-200">
          <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">İletişim</p>
          {showContact ? (
            <div className="mt-3 space-y-2 text-gray-100">
              {sender?.email ? (
                <a href={`mailto:${sender.email}`} className="block text-soft-gold underline-offset-4 hover:underline">
                  {sender.email}
                </a>
              ) : (
                <p className="text-gray-400">E-posta belirtilmemiş.</p>
              )}
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-soft-gold underline-offset-4 hover:underline"
                >
                  Website
                </a>
              ) : (
                <p className="text-gray-400">Website paylaşılmadı.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-gray-400">
              Marka iletişim bilgileri teklifi kabul ettiğinde otomatik açılır. Karar vermek için önce durum seç.
            </p>
          )}
        </section>
      </div>
    )
  }

  const listContent =
    filteredOffers.length === 0 ? (
      <div className="rounded-2xl border border-white/10 bg-[#0F1014] p-6 text-center text-sm text-gray-400">
        Bu filtre için teklif bulunamadı.
      </div>
    ) : (
      <div className="space-y-3">{filteredOffers.map(renderListItem)}</div>
    )

  return (
    <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-soft-gold">Teklifler</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Gelen işbirlikleri</h2>
          <p className="text-sm text-gray-400">Sol listeden marka seç, sağda detaylarını yönet.</p>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-soft-gold">
          Durum
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1014] px-4 py-2 text-sm text-white outline-none transition hover:border-soft-gold/60"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#0F1014] text-white">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">{listContent}</div>
      </div>
      {renderDetail()}
    </div>
  )
}


