'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { toast } from 'sonner'
import { Lock, MessageSquare, Search } from 'lucide-react'
import { parseChatImageUrl } from '@/lib/chat-image'
import { markRoomsRead } from '@/lib/room-reads'
import { JOB_KIND_LABEL } from '@/lib/conversation-jobs'
import { ROOM_CLOSED_TEXT, type RoomClosedReason } from '@/lib/room-close'
import { Avatar, Card, EmptyState, Input, Segmented, VerifiedTick } from '@/components/ui'
import { normalizeText } from '@/lib/advert-alerts-shared'
import { cn } from '@/utils/cn'
import ChatThread from './ChatThread'
import { participantTick, type ChatMessage, type Conversation } from './types'

interface Props {
  currentUserId: string
  role: 'influencer' | 'brand'
  initialConversations: Conversation[]
  /** Bu kişiyle mevcut sohbeti açar (yeni oda açılmaz; sohbet teklif/başvuru ile başlar). */
  initialUserId?: string
  /** Bu odayı açar. */
  initialRoomId?: string
  currentUserVerificationStatus?: 'pending' | 'verified' | 'rejected'
}

type Filter = 'all' | 'unread' | 'active'

/** Uzun sohbetlerde en yeni mesajlar gelsin diye sondan okunur (PostgREST tek seferde en fazla 1000 satır döndürür). */
const MESSAGE_LIMIT = 500

function listTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const key = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  if (key(d) === key(now)) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
  if (key(d) === key(new Date(now.getTime() - 86_400_000))) return 'Dün'
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' })
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' })
}

const preview = (c: Conversation, me: string) => {
  if (!c.lastMessage) return 'Henüz mesaj yok'
  const text = parseChatImageUrl(c.lastMessage.content) ? 'Fotoğraf' : c.lastMessage.content
  return c.lastMessage.senderId === me && !c.lastMessage.isSystem ? `Sen: ${text}` : text
}

/** Mesajlar: sohbet listesi (aynı kişiyle olan odalar tek sohbet) + seçili sohbet. */
export default function Inbox({ currentUserId, role, initialConversations, initialUserId, initialRoomId, currentUserVerificationStatus }: Props) {
  const supabase = useSupabaseClient()
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId ?? null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [thread, setThread] = useState<{ participantId: string; roomIds: string[]; messages: ChatMessage[] } | null>(null)
  // oda → karşı taraf (yeni mesajı doğru sohbete yazmak için)
  // oda listesi gelene kadar null: mesajlar ancak bütün odalar bilinince yüklenir (aksi hâlde iki kez yüklenirdi).
  const [roomOwner, setRoomOwner] = useState<Map<string, string> | null>(null)
  // Kapalı odalar → kapanma nedeni (3.6-S8: teklif geri çekildi; salt okunur).
  const [closedRooms, setClosedRooms] = useState<Map<string, RoomClosedReason>>(new Map())

  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations

  // Bütün odalar ve karşı tarafları.
  useEffect(() => {
    supabase
      .from('rooms')
      .select('id, brand_id, influencer_id, created_at, closed_at, closed_reason')
      .or(`brand_id.eq.${currentUserId},influencer_id.eq.${currentUserId}`)
      .then(({ data, error }) => {
        if (error) console.error('[Inbox] rooms load error', error.message)
        const map = new Map<string, string>()
        const closed = new Map<string, RoomClosedReason>()
        data?.forEach((r) => {
          const other = r.brand_id === currentUserId ? r.influencer_id : r.brand_id
          if (other && other !== currentUserId) map.set(r.id, other)
          if (r.closed_at) closed.set(r.id, (r.closed_reason ?? 'offer_withdrawn') as RoomClosedReason)
        })
        setClosedRooms(closed)
        setRoomOwner(map)
      })
  }, [supabase, currentUserId])

  // Sohbet açıkken oda kapanırsa (marka teklifi geri çekti) yazma alanı hemen kapanır.
  useEffect(() => {
    const channel = supabase
      .channel('inbox-rooms')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, (payload) => {
        const room = payload.new as { id: string; closed_at: string | null; closed_reason: string | null }
        setClosedRooms((prev) => {
          if (!room.closed_at || prev.has(room.id)) return prev
          const next = new Map(prev)
          next.set(room.id, (room.closed_reason ?? 'offer_withdrawn') as RoomClosedReason)
          return next
        })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // ?roomId= başka bir kişinin ikincil odasıysa da o kişinin sohbeti açılır.
  const selected = useMemo(() => {
    if (!selectedRoomId) return null
    const direct = conversations.find((c) => c.roomId === selectedRoomId)
    if (direct) return direct
    const owner = roomOwner?.get(selectedRoomId)
    return owner ? (conversations.find((c) => c.otherParticipant?.id === owner) ?? null) : null
  }, [selectedRoomId, conversations, roomOwner])
  const selectedParticipantId = selected?.otherParticipant?.id ?? null

  // ?userId=: bu kişiyle sohbet varsa açılır; yoksa açıklama (oda yalnızca teklif/başvuru ile açılır).
  useEffect(() => {
    if (!initialUserId || initialUserId === currentUserId) return
    const existing = conversationsRef.current.find((c) => c.otherParticipant?.id === initialUserId)
    if (existing) setSelectedRoomId(existing.roomId)
    else toast.info('Bu kişiyle henüz bir sohbet yok. Sohbet, teklif ya da ilan başvurusu üzerinden açılır.')
  }, [initialUserId, currentUserId])

  // Seçili kişiyle olan bütün odaların mesajları.
  useEffect(() => {
    if (!selectedParticipantId) {
      setThread(null)
      return
    }
    if (!roomOwner) return
    let cancelled = false
    const roomIds = Array.from(roomOwner.entries())
      .filter(([, owner]) => owner === selectedParticipantId)
      .map(([id]) => id)
    const ids = roomIds.length > 0 ? roomIds : selected ? [selected.roomId] : []
    if (ids.length === 0) return
    setThread(null)
    supabase
      .from('messages')
      .select('id, sender_id, content, created_at, room_id, is_system')
      .in('room_id', ids)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[Inbox] messages load error', error.message)
          toast.error('Mesajlar yüklenemedi.')
          return
        }
        setThread({ participantId: selectedParticipantId, roomIds: ids, messages: (data ?? []).slice().reverse() })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParticipantId, roomOwner, supabase])

  // Liste: yeni mesajda son mesaj ve okunmamış sayısı güncellenir (RLS yalnızca kendi odalarının olaylarını gönderir).
  useEffect(() => {
    const channel = supabase
      .channel('inbox-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as ChatMessage & { room_id: string }
        const owner = roomOwner?.get(msg.room_id)
        if (!owner) return
        const isOpen = owner === selectedParticipantId
        setConversations((prev) =>
          prev
            .map((c) =>
              c.otherParticipant?.id === owner
                ? {
                    ...c,
                    lastMessage: { content: msg.content, createdAt: msg.created_at, senderId: msg.sender_id, isSystem: !!msg.is_system },
                    unreadCount: msg.sender_id !== currentUserId && !isOpen ? c.unreadCount + 1 : c.unreadCount,
                  }
                : c,
            )
            .sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? '')),
        )
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, roomOwner, selectedParticipantId, currentUserId])

  const open = (c: Conversation) => {
    setSelectedRoomId(c.roomId)
    setConversations((prev) => prev.map((x) => (x.roomId === c.roomId ? { ...x, unreadCount: 0 } : x)))
    markRoomsRead(supabase, currentUserId, [c.roomId])
    const url = new URL(window.location.href)
    url.searchParams.set('roomId', c.roomId)
    url.searchParams.delete('userId')
    window.history.replaceState(null, '', url)
  }

  const back = () => {
    setSelectedRoomId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('roomId')
    window.history.replaceState(null, '', url)
  }

  // Yeni mesaj, açık odalardan en son yazışılana gider (mesaj yoksa sohbetin kendi odası). Aynı kişiyle olan
  // bütün odalar kapalıysa sohbet salt okunur (3.6-S8); kapalı bir odaya yazılmaz.
  const threadRoom = useMemo(() => {
    if (!thread) return null
    const openIds = thread.roomIds.filter((id) => !closedRooms.has(id))
    if (openIds.length === 0) {
      const lastClosed = [...thread.messages].reverse().find((m) => m.room_id)?.room_id ?? thread.roomIds[0]
      const reason = closedRooms.get(lastClosed) ?? closedRooms.get(thread.roomIds[0]) ?? 'offer_withdrawn'
      return { primaryRoomId: lastClosed, closedNotice: `${ROOM_CLOSED_TEXT[reason]} Bu sohbet kapandı; mesaj geçmişi görünür, yeni mesaj yazılamaz.` }
    }
    const lastOpen = [...thread.messages].reverse().find((m) => m.room_id && openIds.includes(m.room_id))?.room_id
    const primaryRoomId = lastOpen ?? (selected && openIds.includes(selected.roomId) ? selected.roomId : openIds[0])
    return { primaryRoomId, closedNotice: null }
  }, [thread, closedRooms, selected])

  const counts = useMemo(
    () => ({ unread: conversations.filter((c) => c.unreadCount > 0).length, active: conversations.filter((c) => c.job?.active).length }),
    [conversations],
  )

  const visible = conversations.filter((c) => {
    if (!c.otherParticipant) return false
    if (filter === 'unread' && c.unreadCount === 0) return false
    if (filter === 'active' && !c.job?.active) return false
    const q = normalizeText(query)
    if (!q) return true
    return normalizeText(`${c.otherParticipant.fullName} ${c.otherParticipant.username ?? ''} ${c.job?.title ?? ''}`).includes(q)
  })

  return (
    <Card className="-mx-4 -mb-24 -mt-6 flex h-[calc(100dvh-7.5rem)] overflow-hidden rounded-none border-x-0 sm:mx-0 sm:mb-0 sm:mt-0 sm:h-[calc(100dvh-6.5rem)] sm:rounded-2xl sm:border-x">
      <aside className={cn('min-h-0 w-full flex-col border-line md:flex md:w-[320px] md:flex-none md:border-r', selected ? 'hidden' : 'flex')}>
        <div className="grid gap-2.5 border-b border-line p-4">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={role === 'brand' ? 'Influencer veya iş ara' : 'Marka veya iş ara'}
              aria-label="Sohbetlerde ara"
              className="h-[34px] pl-9"
            />
          </label>
          <Segmented
            label="Sohbet filtresi"
            value={filter}
            onSelect={(v) => setFilter(v as Filter)}
            items={[
              { value: 'all', label: 'Tümü' },
              { value: 'unread', label: `Okunmamış${counts.unread ? ` ${counts.unread}` : ''}` },
              { value: 'active', label: `Süren işler${counts.active ? ` ${counts.active}` : ''}` },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={conversations.length === 0 ? 'Henüz sohbet yok' : 'Eşleşen sohbet yok'}
              description={conversations.length === 0 ? 'Sohbet, bir teklif ya da ilan başvurusu üzerinden açılır.' : undefined}
            />
          ) : (
            visible.map((c) => {
              const p = c.otherParticipant!
              const tick = participantTick(p)
              const isSel = selected?.otherParticipant?.id === p.id
              const unread = c.unreadCount > 0
              return (
                <button
                  key={c.roomId}
                  type="button"
                  onClick={() => open(c)}
                  aria-current={isSel || undefined}
                  className={cn(
                    'flex w-full gap-2.5 border-b border-line px-4 py-3 text-left transition-colors',
                    isSel ? 'bg-surface-2 shadow-[inset_2px_0_0_theme(colors.gold.DEFAULT)]' : 'hover:bg-surface-1',
                  )}
                >
                  <Avatar name={p.fullName} src={p.avatarUrl} square={p.role === 'brand'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[13.5px] font-medium text-ink">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{p.fullName}</span>
                        {tick && <VerifiedTick tone={tick.tone} label={tick.label} />}
                      </span>
                      {c.lastMessage && <time className="flex-none text-[11.5px] font-normal text-ink-faint">{listTime(c.lastMessage.createdAt)}</time>}
                    </div>
                    {c.job && (
                      <div className="mt-px truncate text-[11.5px] text-gold">
                        {JOB_KIND_LABEL[c.job.kind]} · {c.job.title}
                      </div>
                    )}
                    <div className={cn('mt-0.5 truncate text-[12.5px]', unread ? 'font-medium text-ink' : 'text-ink-muted')}>{preview(c, currentUserId)}</div>
                  </div>
                  {unread && (
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-gold" aria-label={`${c.unreadCount} okunmamış mesaj`} />
                  )}
                </button>
              )
            })
          )}
        </div>
      </aside>

      <div className={cn('min-h-0 min-w-0 flex-1 flex-col', selected ? 'flex' : 'hidden md:flex')}>
        {selected?.otherParticipant ? (
          thread && threadRoom && thread.participantId === selected.otherParticipant.id ? (
            <ChatThread
              key={selected.otherParticipant.id}
              roomId={threadRoom.primaryRoomId}
              roomIds={thread.roomIds}
              closedNotice={threadRoom.closedNotice}
              currentUserId={currentUserId}
              currentUserRole={role}
              isSenderVerified={currentUserVerificationStatus === 'verified'}
              participant={selected.otherParticipant}
              job={selected.job}
              initialMessages={thread.messages}
              onBack={back}
            />
          ) : (
            <p className="m-auto text-[13px] text-ink-faint">Mesajlar yükleniyor…</p>
          )
        ) : (
          <EmptyState
            className="m-auto"
            icon={MessageSquare}
            title="Bir sohbet seç"
            description={
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3 w-3" aria-hidden />
                Güvenliğin için konuşmalar kayıt altında tutulur.
              </span>
            }
          />
        )}
      </div>
    </Card>
  )
}
