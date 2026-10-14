'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MessageSquare, Pencil, Send, Undo2, X } from 'lucide-react'
import { dismissInfluencer } from '@/app/dashboard/brand/offers/dismiss/actions'
import { editOffer, withdrawOffer } from '@/app/dashboard/brand/offers/actions'
import type { BrandOfferItem } from '@/lib/works'
import { countUnreadInRoom } from '@/lib/unread-messages'
import { OFFER_CAMPAIGN_TYPES, OFFER_EXPIRY_DAYS, effectiveOfferStatus } from '@/lib/offer-shared'
import { Avatar, Button, ButtonLink, Card, Chip, ConfirmDialog, EmptyState, Field, Input, ListRow, Modal, Select, Textarea, VerifiedTick, type ChipTone } from '@/components/ui'

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
  withdrawn: 'Geri çekildi',
}

const STATUS_TONES: Record<string, ChipTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  withdrawn: 'neutral',
}

interface EditForm {
  campaignName: string
  campaignType: string
  paymentType: 'cash' | 'barter'
  budget: string
  message: string
}

const editFormOf = (offer: BrandOfferItem): EditForm => ({
  campaignName: offer.campaign_name ?? '',
  campaignType: offer.campaign_type ?? '',
  paymentType: offer.payment_type === 'barter' ? 'barter' : 'cash',
  budget: offer.budget === null || offer.budget === undefined ? '' : String(offer.budget),
  message: offer.message ?? '',
})

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
  // Ayrıntı penceresi kişi kimliğiyle tutulur; teklif düzenlenince / geri çekilince pencere güncel listeyi gösterir.
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null)

  const [isDismissing, startDismissTransition] = useTransition()
  const [dismissTarget, setDismissTarget] = useState<string | null>(null)

  // Bekleyen teklifi düzenleme / geri çekme (lib/offers.ts; süre yeniden başlamaz, kota iade edilmez).
  const [isSaving, startSaveTransition] = useTransition()
  const [editing, setEditing] = useState<BrandOfferItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<BrandOfferItem | null>(null)

  const applyOfferPatch = useCallback((offerId: string, patch: Partial<BrandOfferItem>) => {
    setOffers((prev) => prev.map((offer) => (offer.id === offerId ? { ...offer, ...patch } : offer)))
  }, [])

  const openEdit = (offer: BrandOfferItem) => {
    setEditing(offer)
    setEditForm(editFormOf(offer))
  }

  const closeEdit = () => {
    if (isSaving) return
    setEditing(null)
    setEditForm(null)
  }

  const handleSaveEdit = () => {
    if (!editing || !editForm) return
    const offerId = editing.id
    startSaveTransition(async () => {
      const result = await editOffer(offerId, {
        campaignName: editForm.campaignName,
        campaignType: editForm.campaignType || null,
        paymentType: editForm.paymentType,
        budget: editForm.budget,
        message: editForm.message,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (result.changed) {
        const budget = editForm.budget.trim() ? Number(editForm.budget) : null
        applyOfferPatch(offerId, {
          campaign_name: editForm.campaignName.trim(),
          campaign_type: editForm.campaignType.trim() || null,
          payment_type: editForm.paymentType,
          budget,
          message: editForm.message.trim() || null,
          edited_at: new Date().toISOString(),
        })
        toast.success('Teklif güncellendi; influencer bilgilendirildi.')
      } else {
        toast('Değişiklik yok.')
      }
      setEditing(null)
      setEditForm(null)
    })
  }

  const handleWithdraw = () => {
    if (!withdrawTarget) return
    const offerId = withdrawTarget.id
    startSaveTransition(async () => {
      const result = await withdrawOffer(offerId)
      setWithdrawTarget(null)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      applyOfferPatch(offerId, { status: 'withdrawn' })
      toast.success('Teklif geri çekildi; influencer bilgilendirildi.')
    })
  }

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

  const selectedGroup = useMemo(
    () => (selectedReceiverId ? groupedOffers.find((group) => group.receiver?.id === selectedReceiverId) ?? null : null),
    [groupedOffers, selectedReceiverId],
  )
  const setSelectedGroup = (group: { receiver: BrandOfferItem['receiver'] } | null) => setSelectedReceiverId(group?.receiver?.id ?? null)


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
          `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at, edited_at,
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
                      {offer.edited_at && <span className="text-ink-faint"> · düzenlendi</span>}
                    </dd>
                  </dl>
                  {offer.message && <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-muted">{offer.message}</p>}
                  {status === 'pending' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <span className="mr-auto text-xs text-ink-faint">{daysLeft(offer.created_at)} gün içinde yanıtlanmazsa düşer; düzenleme süreyi uzatmaz.</span>
                      <Button size="sm" variant="ghost" leftIcon={<Undo2 />} disabled={isSaving} onClick={() => {
                          setSelectedReceiverId(null)
                          setWithdrawTarget(offer)
                        }}>
                        Geri çek
                      </Button>
                      <Button size="sm" leftIcon={<Pencil />} disabled={isSaving} onClick={() => {
                          setSelectedReceiverId(null)
                          openEdit(offer)
                        }}>
                        Düzenle
                      </Button>
                    </div>
                  )}
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

      <ConfirmDialog
        open={withdrawTarget !== null}
        onClose={() => !isSaving && setWithdrawTarget(null)}
        onConfirm={handleWithdraw}
        title="Teklifi geri çek"
        description="Influencer bilgilendirilir ve teklif artık yanıtlanamaz. Geri çekilen teklif bu ayki teklif hakkından düşmez."
        confirmLabel="Geri çek"
        tone="danger"
        loading={isSaving}
      />

      <Modal
        open={editing !== null && editForm !== null}
        onClose={closeEdit}
        dismissible={!isSaving}
        title="Teklifi düzenle"
        description="Influencer bilgilendirilir. Yanıt süresi yeniden başlamaz."
        footer={
          <>
            <Button variant="ghost" size="sm" disabled={isSaving} onClick={closeEdit}>
              Vazgeç
            </Button>
            <Button variant="primary" size="sm" loading={isSaving} onClick={handleSaveEdit}>
              Kaydet
            </Button>
          </>
        }
      >
        {editForm && (
          <div className="grid gap-3">
            <Field label="Kampanya adı">
              {(props) => (
                <Input
                  {...props}
                  maxLength={120}
                  value={editForm.campaignName}
                  onChange={(e) => setEditForm({ ...editForm, campaignName: e.target.value })}
                />
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kampanya türü">
                {(props) => (
                  <Select {...props} value={editForm.campaignType} onChange={(e) => setEditForm({ ...editForm, campaignType: e.target.value })}>
                    {/* Mobilden serbest metinle gönderilen tür de listede kalır. */}
                    {[...OFFER_CAMPAIGN_TYPES, ...(editForm.campaignType && !(OFFER_CAMPAIGN_TYPES as readonly string[]).includes(editForm.campaignType) ? [editForm.campaignType] : [])].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                    {!editForm.campaignType && <option value="">Belirtilmedi</option>}
                  </Select>
                )}
              </Field>
              <Field label="Ödeme türü">
                {(props) => (
                  <Select
                    {...props}
                    value={editForm.paymentType}
                    onChange={(e) => setEditForm({ ...editForm, paymentType: e.target.value === 'barter' ? 'barter' : 'cash' })}
                  >
                    <option value="cash">Nakit (Para)</option>
                    <option value="barter">Barter (Ürün)</option>
                  </Select>
                )}
              </Field>
            </div>
            <Field label={editForm.paymentType === 'barter' ? 'Ürün piyasa değeri (₺)' : 'Bütçe (₺)'} hint="Boş bırakılırsa “Belirlenmedi” görünür.">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={editForm.budget}
                  onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                />
              )}
            </Field>
            <Field label="Mesaj">
              {(props) => (
                <Textarea
                  {...props}
                  rows={5}
                  maxLength={2000}
                  value={editForm.message}
                  onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                />
              )}
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
