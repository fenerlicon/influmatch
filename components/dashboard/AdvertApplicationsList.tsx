'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock, XCircle, MessageCircle, BadgeCheck } from 'lucide-react'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'

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

export interface AdvertApplication {
  id: string
  advert_id: string
  advert_title: string
  advert_category: string | null
  influencer: {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
    verification_status?: 'pending' | 'verified' | 'rejected' | null
  }
  brand?: {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
    verification_status?: 'pending' | 'verified' | 'rejected' | null
  }
  cover_letter: string | null
  deliverable_idea: string | null
  budget_expectation: number | null
  status: 'pending' | 'shortlisted' | 'rejected' | 'accepted'
  created_at: string
  room_id?: string | null
  has_messages?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'İletişime Geçildi',
  shortlisted: 'Ön Listede',
  rejected: 'Reddedildi',
  accepted: 'Kabul Edildi',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-yellow-200 border-yellow-400/60 bg-yellow-400/10',
  shortlisted: 'text-blue-200 border-blue-400/60 bg-blue-400/10',
  rejected: 'text-red-200 border-red-400/60 bg-red-400/10',
  accepted: 'text-emerald-200 border-emerald-400/60 bg-emerald-400/10',
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  shortlisted: CheckCircle2,
  rejected: XCircle,
  accepted: CheckCircle2,
}

const formatBudget = (value: number | null) => {
  if (value === null || value === undefined) return 'Belirtilmedi'
  if (value === 0) return 'Barter (Ürün Karşılığı)'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value)
}

interface AdvertApplicationsListProps {
  applications: AdvertApplication[]
  isInfluencerView?: boolean
  currentUserId?: string
  onOpenChat?: (applicationId: string) => void
}

export default function AdvertApplicationsList({ applications, isInfluencerView = false, currentUserId, onOpenChat }: AdvertApplicationsListProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [applicationsWithMessages, setApplicationsWithMessages] = useState<Set<string>>(
    new Set(applications.filter((app) => app.has_messages).map((app) => app.id))
  )
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map())

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

  // Fetch unread counts for all applications with rooms
  useEffect(() => {
    if (!currentUserId) return

    const fetchUnreadCounts = async () => {
      const counts = new Map<string, number>()
      await Promise.all(
        applications.map(async (app) => {
          if (app.room_id) {
            const unreadCount = await calculateUnreadCount(app.room_id)
            if (unreadCount > 0) {
              counts.set(app.id, unreadCount)
            }
          }
        }),
      )
      setUnreadCounts(counts)
    }

    fetchUnreadCounts()

    // Set up real-time subscription for messages
    const roomIds = applications.filter((app) => app.room_id).map((app) => app.room_id!).filter(Boolean)
    if (roomIds.length === 0) return

    const channels = roomIds.map((roomId) => {
      const channel = supabase
        .channel(`advert-app-messages-${roomId}`)
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
              // Recalculate unread counts after a short delay to ensure message is in DB
              setTimeout(async () => {
                const app = applications.find((a) => a.room_id === roomId)
                if (app) {
                  const unreadCount = await calculateUnreadCount(roomId)
                  setUnreadCounts((prev) => {
                    const next = new Map(prev)
                    if (unreadCount > 0) {
                      next.set(app.id, unreadCount)
                    } else {
                      next.delete(app.id)
                    }
                    return next
                  })
                }
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
            // Recalculate unread counts when read receipts change for current user
            const app = applications.find((a) => a.room_id === roomId)
            if (app) {
              const unreadCount = await calculateUnreadCount(roomId)
              setUnreadCounts((prev) => {
                const next = new Map(prev)
                if (unreadCount > 0) {
                  next.set(app.id, unreadCount)
                } else {
                  next.delete(app.id)
                }
                return next
              })
            }
          },
        )
        .subscribe()

      return channel
    })

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel))
    }
  }, [applications, currentUserId, supabase, calculateUnreadCount])

  // Update applicationsWithMessages when applications prop changes
  useEffect(() => {
    setApplicationsWithMessages(
      new Set(applications.filter((app) => app.has_messages).map((app) => app.id))
    )
  }, [applications])

  // Real-time subscription for messages (influencer view only)
  useEffect(() => {
    if (!isInfluencerView || !currentUserId) return

    const roomIds = applications
      .filter((app) => app.room_id)
      .map((app) => app.room_id)
      .filter(Boolean) as string[]

    if (roomIds.length === 0) return

    const subscriptions: any[] = []

    roomIds.forEach((roomId) => {
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
          (payload) => {
            // Check if message is from brand (not influencer)
            if (payload.new.sender_id !== currentUserId) {
              // Find application by room_id
              const app = applications.find((a) => a.room_id === roomId)
              if (app) {
                setApplicationsWithMessages((prev) => new Set([...prev, app.id]))
              }
            }
          },
        )
        .subscribe()

      subscriptions.push(channel)
    })

    return () => {
      subscriptions.forEach((sub) => supabase.removeChannel(sub))
    }
  }, [applications, isInfluencerView, currentUserId, supabase])

  const handleOpenChat = async (application: AdvertApplication) => {
    if (onOpenChat) {
      onOpenChat(application.id)
      return
    }

    setChatLoadingId(application.id)
    startTransition(async () => {
      try {
        // If brand view: navigate to influencer's profile
        // If influencer view: navigate to brand's profile
        const targetUserId = isInfluencerView ? application.brand?.id : application.influencer.id

        if (!targetUserId) {
          console.error('Target user ID not found for application')
          return
        }

        // Navigate to messages page with target user ID
        // Messages page will automatically find existing room or create a new one
        router.push(`/dashboard/messages?userId=${targetUserId}`)
      } finally {
        setChatLoadingId(null)
      }
    })
  }
  if (applications.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
        <p>{isInfluencerView ? 'Henüz hiç başvuru yapmadın.' : 'Henüz hiç başvuru yok.'}</p>
        <p className="mt-2 text-sm text-gray-400">
          {isInfluencerView
            ? 'Açık ilanlar sekmesinden ilanlara başvurabilirsin.'
            : 'İlanlarınız açık olduğunda influencerlar burada görünecek.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => {
        const StatusIcon = STATUS_ICONS[application.status] || Clock
        return (
          <article
            key={application.id}
            className="rounded-3xl border border-white/10 bg-[#0B0C10] p-5 text-white transition hover:border-soft-gold/40 hover:shadow-glow"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: Influencer/Brand Info */}
              <div className="flex items-start gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {isInfluencerView && application.brand ? (
                    application.brand.avatar_url ? (
                      <Image
                        src={application.brand.avatar_url}
                        alt={application.brand.full_name ?? 'Marka'}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-soft-gold">
                        {application.brand.full_name?.[0] ?? 'M'}
                      </div>
                    )
                  ) : application.influencer.avatar_url ? (
                    <Image
                      src={application.influencer.avatar_url}
                      alt={application.influencer.full_name ?? 'Influencer'}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-soft-gold">
                      {isInfluencerView ? 'M' : (application.influencer.full_name?.[0] ?? 'I')}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {isInfluencerView
                        ? (application.brand?.full_name ?? 'Marka')
                        : (application.influencer.full_name ?? 'Influencer')}
                    </h3>
                    {isInfluencerView && application.brand?.verification_status === 'verified' && (
                      <div className="group relative flex-shrink-0">
                        <BadgeCheck className="h-4 w-4 text-soft-gold" />
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-xs text-white group-hover:block">
                          Onaylanmış İşletme
                        </div>
                      </div>
                    )}
                    {!isInfluencerView && application.influencer.verification_status === 'verified' && (
                      <div className="group relative flex-shrink-0">
                        <BadgeCheck className="h-4 w-4 text-blue-400" />
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-xs text-white group-hover:block">
                          Onaylı hesap
                        </div>
                      </div>
                    )}
                  </div>
                  {isInfluencerView && application.brand?.username && (
                    <p className="mt-1 text-sm text-gray-400">@{application.brand.username}</p>
                  )}
                  {!isInfluencerView && application.influencer.username && (
                    <p className="mt-1 text-sm text-gray-400">@{application.influencer.username}</p>
                  )}
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-soft-gold">{application.advert_title}</p>
                    {application.advert_category && (
                      <span className="mt-1 inline-block rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-300">
                        {application.advert_category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Date and Actions */}
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <CalendarDays className="h-4 w-4" />
                  <span>{formatRelativeTime(application.created_at)}</span>
                </div>
                {/* Brand: İletişime Geç button */}
                {!isInfluencerView && (
                  <button
                    type="button"
                    onClick={() => handleOpenChat(application)}
                    disabled={chatLoadingId === application.id || isPending}
                    className="relative rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-xs font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-70 flex items-center gap-2"
                  >
                    {chatLoadingId === application.id ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-soft-gold border-t-transparent" />
                        Açılıyor...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-3.5 w-3.5" />
                        İletişime Geç
                        {application.room_id && unreadCounts.get(application.id) && unreadCounts.get(application.id)! > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg">
                            {unreadCounts.get(application.id)! > 9 ? '9+' : unreadCounts.get(application.id)}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )}

              </div>
            </div>

            {/* Application Details */}
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              {application.cover_letter && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Niyet Mesajı</p>
                  <p className="mt-1 text-sm text-gray-300">{application.cover_letter}</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {application.deliverable_idea && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Önerilen Teslimat</p>
                    <p className="mt-1 text-sm text-gray-300">{application.deliverable_idea}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Bütçe Beklentisi</p>
                  <p className="mt-1 text-sm font-semibold text-soft-gold">
                    {formatBudget(application.budget_expectation)}
                  </p>
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

