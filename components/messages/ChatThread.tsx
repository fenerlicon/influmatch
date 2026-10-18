'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { toast } from 'sonner'
import { ArrowLeft, Briefcase, MessageSquare, UserRound } from 'lucide-react'
import { isUserBlocked } from '@/app/dashboard/users/block/actions'
import { sendMessage } from '@/app/dashboard/messages/send/actions'
import { getParticipantLastRead } from '@/app/dashboard/messages/actions'
import { compressImage } from '@/lib/image-compress'
import {
  CHAT_READ_EVENT,
  CHAT_TYPING_EVENT,
  CHAT_TYPING_SHOW_MS,
  CHAT_TYPING_THROTTLE_MS,
  chatLiveChannel,
  isSeenBy,
} from '@/lib/chat-live-shared'
import { chatAttachmentPath, parseChatImageUrl } from '@/lib/chat-image'
import { markRoomsRead } from '@/lib/room-reads'
import { JOB_KIND_LABEL, type ConversationJob } from '@/lib/conversation-jobs'
import { Avatar, Button, ButtonLink, Chip, EmptyState, VerifiedTick } from '@/components/ui'
import { cn } from '@/utils/cn'
import Composer from './Composer'
import MessageMenu from './MessageMenu'
import ProfileSheet from './ProfileSheet'
import { participantTick, type ChatMessage, type Participant } from './types'

interface Props {
  /** Yeni mesajın gideceği oda (aynı kişiyle en son yazışılan oda). */
  roomId: string
  /** Aynı kişiyle olan bütün odalar (birleşik gösterilir). */
  roomIds: string[]
  /** Aynı kişiyle olan bütün odalar kapalıysa nedeni (salt okunur sohbet, 3.6-S8). */
  closedNotice?: string | null
  currentUserId: string
  currentUserRole: 'influencer' | 'brand' | 'admin'
  isSenderVerified: boolean
  participant: Participant
  job?: ConversationJob | null
  initialMessages: ChatMessage[]
  onBack: () => void
}

const TZ = 'Europe/Istanbul'
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })

function dayLabel(iso: string) {
  const key = dayKey(iso)
  const today = dayKey(new Date().toISOString())
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString())
  if (key === today) return 'Bugün'
  if (key === yesterday) return 'Dün'
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: TZ })
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

/** Sohbet: başlık, iş satırı, mesajlar (günlere ayrılmış), yazma alanı. */
export default function ChatThread({ roomId, roomIds, closedNotice, currentUserId, currentUserRole, isSenderVerified, participant, job, initialMessages, onBack }: Props) {
  const supabase = useSupabaseClient()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [signed, setSigned] = useState<Record<string, string>>({})
  const requested = useRef<Set<string>>(new Set())
  const [isSending, setIsSending] = useState(false)
  const [blockedByThem, setBlockedByThem] = useState(false)
  const [blockedByMe, setBlockedByMe] = useState(false)
  const [blockCheck, setBlockCheck] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Canlı durum (lib/chat-live-shared.ts): karşı tarafın son okuma zamanı ve "yazıyor…".
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const liveRef = useRef<RealtimeChannel | null>(null)
  const typingSentAt = useRef(0)
  const typingTimer = useRef<number | null>(null)
  const tick = participantTick(participant)
  const restricted = currentUserRole === 'brand' && !isSenderVerified
  const roomsKey = roomIds.join(',')

  useEffect(() => setMessages(initialMessages), [initialMessages])

  // Sohbet ekleri gizli kovada; görüntülemek için 1 saatlik imzalı bağlantı üretilir.
  useEffect(() => {
    const missing = Array.from(
      new Set(
        messages
          .map((m) => parseChatImageUrl(m.content))
          .map((url) => (url ? chatAttachmentPath(url) : null))
          .filter((p): p is string => !!p && !requested.current.has(p)),
      ),
    )
    if (missing.length === 0) return
    missing.forEach((p) => requested.current.add(p))
    supabase.storage
      .from('chat-attachments')
      .createSignedUrls(missing, 60 * 60)
      .then(({ data, error }) => {
        if (error || !data) {
          missing.forEach((p) => requested.current.delete(p))
          return
        }
        setSigned((prev) => {
          const next = { ...prev }
          data.forEach((item) => item.path && item.signedUrl && (next[item.path] = item.signedUrl))
          return next
        })
      })
  }, [messages, supabase])

  useEffect(() => {
    isUserBlocked(participant.id).then((r) => {
      setBlockedByThem(r.blocked)
      setBlockedByMe(r.hasBlocked ?? false)
    })
  }, [participant.id, blockCheck])

  // Aynı kişiyle olan bütün odaların yeni mesajları.
  useEffect(() => {
    const ids = roomsKey ? roomsKey.split(',') : [roomId]
    const channels = ids.map((rId) =>
      supabase
        .channel(`room-${rId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${rId}` }, (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        })
        .subscribe(),
    )
    return () => channels.forEach((c) => supabase.removeChannel(c))
  }, [roomId, roomsKey, supabase])

  // Karşı tarafın okuma zamanı (açılışta sunucudan; sonra yayın kanalından).
  useEffect(() => {
    let active = true
    getParticipantLastRead(participant.id, roomsKey ? roomsKey.split(',') : [roomId])
      .then((at) => active && setOtherReadAt((prev) => (prev && at && prev > at ? prev : at)))
      .catch(() => null)
    return () => {
      active = false
    }
  }, [participant.id, roomId, roomsKey])

  // "yazıyor…" ve "Görüldü" için iki kişiye özel yayın kanalı (veritabanına yazılmaz; mobil aynı kanalı kullanır).
  useEffect(() => {
    const channel = supabase
      .channel(chatLiveChannel(currentUserId, participant.id), { config: { broadcast: { self: false } } })
      .on('broadcast', { event: CHAT_TYPING_EVENT }, ({ payload }) => {
        if (payload?.userId !== participant.id) return
        setOtherTyping(true)
        if (typingTimer.current) window.clearTimeout(typingTimer.current)
        typingTimer.current = window.setTimeout(() => setOtherTyping(false), CHAT_TYPING_SHOW_MS)
      })
      .on('broadcast', { event: CHAT_READ_EVENT }, ({ payload }) => {
        if (payload?.userId !== participant.id || typeof payload?.at !== 'string') return
        setOtherReadAt((prev) => (prev && prev > payload.at ? prev : payload.at))
      })
      .subscribe()
    liveRef.current = channel
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current)
      liveRef.current = null
      supabase.removeChannel(channel)
    }
  }, [currentUserId, participant.id, supabase])

  // Birleşik gösterilen bütün odalar okundu sayılır (room_reads); karşı tarafa "Görüldü" sinyali gider.
  useEffect(() => {
    markRoomsRead(supabase, currentUserId, roomsKey ? roomsKey.split(',') : [roomId]).then((ok) => {
      if (ok && document.visibilityState === 'visible') {
        liveRef.current?.send({ type: 'broadcast', event: CHAT_READ_EVENT, payload: { userId: currentUserId, at: new Date().toISOString() } })
      }
    })
  }, [roomId, roomsKey, currentUserId, messages.length, supabase])

  // Karşı taraf yeni mesaj gönderince "yazıyor…" kapanır.
  const lastMessageSender = messages[messages.length - 1]?.sender_id
  useEffect(() => {
    if (lastMessageSender === participant.id) setOtherTyping(false)
  }, [lastMessageSender, participant.id, messages.length])

  const notifyTyping = () => {
    const now = Date.now()
    if (now - typingSentAt.current < CHAT_TYPING_THROTTLE_MS) return
    typingSentAt.current = now
    liveRef.current?.send({ type: 'broadcast', event: CHAT_TYPING_EVENT, payload: { userId: currentUserId } })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, otherTyping])

  // İyimser gönderim (2026-10-19): mesaj hemen ekranda görünür ("Gönderiliyor…"), sunucu yanıtıyla gerçek kayda dönüşür.
  const send = async (content: string) => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const temp: ChatMessage = { id: tempId, sender_id: currentUserId, content, created_at: new Date().toISOString(), room_id: roomId, pending: true }
    setMessages((prev) => [...prev, temp])
    const result = await sendMessage(roomId, content).catch(() => ({ success: false as const, error: 'Bağlantı hatası. Mesaj gönderilemedi.' }))
    if (!result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      if (result.error?.includes('engelle') || result.error?.includes('block')) setBlockedByThem(true)
      toast.error(result.error || 'Mesaj gönderilemedi.')
      return
    }
    const msg = result.data as ChatMessage
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId)
      return withoutTemp.some((m) => m.id === msg.id) ? withoutTemp : [...withoutTemp, msg]
    })
  }

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error('Yalnızca görsel gönderebilirsin (PNG, JPEG, WEBP).')
    if (file.size > 5 * 1024 * 1024) return toast.error('Görsel en fazla 5 MB olabilir.')
    setIsSending(true)
    try {
      // Yüklemeden önce küçültülür (en uzun kenar 1600 px, WebP): depolama ve indirme kotası korunur, görsel hızlı açılır.
      const compressed = await compressImage(file)
      const path = `${roomId}/${currentUserId}/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${compressed.extension}`
      const { error } = await supabase.storage.from('chat-attachments').upload(path, compressed.file, { contentType: compressed.file.type || file.type, cacheControl: '31536000' })
      if (error) throw error
      const {
        data: { publicUrl },
      } = supabase.storage.from('chat-attachments').getPublicUrl(path)
      await send(`![image](${publicUrl})`)
    } catch (error) {
      console.error('[ChatThread] upload error', error)
      toast.error('Görsel yüklenemedi. Tekrar dene.')
    } finally {
      setIsSending(false)
    }
  }

  // "Görüldü / Gönderildi" yalnızca son kendi mesajının altında.
  let lastOwnIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === currentUserId && !messages[i].is_system) {
      lastOwnIndex = i
      break
    }
  }

  const notice = closedNotice
    ? closedNotice
    : blockedByThem
    ? 'Bu kullanıcı seni engellemiş; mesaj gönderemezsin.'
    : blockedByMe
      ? 'Bu kullanıcıyı engelledin. Engeli profil penceresinden kaldırabilirsin.'
      : restricted
        ? 'Hesabın onaylanınca mesaj gönderebilirsin.'
        : null

  const subtitle = [participant.role === 'brand' ? 'Marka' : participant.role === 'admin' ? 'Yönetici' : 'Influencer', tick?.tone === 'gold' && participant.role === 'brand' ? 'Onaylı marka' : null, participant.username ? `@${participant.username}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <Button size="sm" variant="ghost" iconOnly aria-label="Sohbetlere dön" className="md:hidden" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <button type="button" onClick={() => setProfileOpen(true)} className="flex min-w-0 items-center gap-3 text-left">
          <Avatar name={participant.fullName} src={participant.avatarUrl} square={participant.role === 'brand'} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="truncate">{participant.fullName}</span>
              {tick && <VerifiedTick tone={tick.tone} label={tick.label} />}
            </div>
            <div className="truncate text-xs text-ink-faint">{subtitle}</div>
          </div>
        </button>
        <Button size="sm" variant="ghost" iconOnly aria-label="Profil" title="Profil" className="ml-auto" onClick={() => setProfileOpen(true)}>
          <UserRound />
        </Button>
      </div>

      {job && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-line bg-surface-1 px-4 py-2.5 text-[13px] sm:px-5">
          <Briefcase className="h-[15px] w-[15px] flex-none text-ink-faint" aria-hidden />
          <span className="min-w-0 truncate">
            <span className="text-ink-faint">{JOB_KIND_LABEL[job.kind]} · </span>
            <span className="font-medium text-ink">{job.title}</span>
          </span>
          <Chip tone={job.tone} className="sm:ml-auto">
            {job.status}
          </Chip>
          <ButtonLink size="sm" href={job.href}>
            {job.kind === 'collaboration' ? 'İşe git' : 'Görüntüle'}
          </ButtonLink>
        </div>
      )}

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Henüz mesaj yok" description="İlk mesajı sen yaz." className="my-auto" />
        ) : (
          messages.map((m, i) => {
            const own = m.sender_id === currentUserId
            const newDay = i === 0 || dayKey(messages[i - 1].created_at) !== dayKey(m.created_at)
            const stored = parseChatImageUrl(m.content)
            const path = stored ? chatAttachmentPath(stored) : null
            const imageUrl = path ? signed[path] : null
            if (m.is_system) {
              return (
                <Fragment key={m.id}>
                  {newDay && <div className="my-1.5 self-center text-[11.5px] text-ink-faint">{dayLabel(m.created_at)}</div>}
                  <div className="my-1 self-center rounded-full border border-line bg-surface-1 px-3 py-1.5 text-center text-[12px] text-ink-muted">
                    {m.content} <time className="ml-1 text-[11px] text-ink-faint">{timeOf(m.created_at)}</time>
                  </div>
                </Fragment>
              )
            }
            return (
              <Fragment key={m.id}>
                {newDay && <div className="my-1.5 self-center text-[11.5px] text-ink-faint">{dayLabel(m.created_at)}</div>}
                <div className={cn('group flex max-w-[84%] items-center gap-1 md:max-w-[64%]', own ? 'self-end' : 'self-start', m.pending && 'opacity-70')}>
                  <div
                    className={cn(
                      'rounded-[14px] border px-[13px] py-2.5 text-[13.5px] leading-normal',
                      own ? 'rounded-br-[4px] border-gold/30 bg-[#2A2512] text-ink' : 'rounded-bl-[4px] border-line bg-surface-2 text-ink',
                      stored && 'p-1.5',
                    )}
                  >
                    {stored ? (
                      imageUrl ? (
                        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] w-60 max-w-full overflow-hidden rounded-lg bg-black/20">
                          {/* İmzalı bağlantı kısa ömürlü ve gizli kovadan; görsel optimizasyonundan geçirilmez. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageUrl} alt="Fotoğraf" className="absolute inset-0 h-full w-full object-cover" />
                        </a>
                      ) : (
                        <div className="grid aspect-[4/3] w-60 max-w-full place-items-center rounded-lg bg-black/20 text-xs text-ink-faint">Fotoğraf yükleniyor…</div>
                      )
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    )}
                    <time className={cn('mt-1 block text-[11px]', own ? 'text-right text-champagne/50' : 'text-ink-faint', stored && 'px-1')}>{timeOf(m.created_at)}</time>
                  </div>

                  {!own && (
                    <div className="transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                      <MessageMenu
                        messageId={m.id}
                        senderId={m.sender_id}
                        roomId={roomId}
                        onBlocked={() => {
                          setBlockedByMe(true)
                          setBlockCheck((n) => n + 1)
                        }}
                      />
                    </div>
                  )}
                </div>
                {i === lastOwnIndex && (
                  <div className="-mt-1.5 self-end pr-1 text-[11px] text-ink-faint" aria-live="polite">
                    {m.pending ? 'Gönderiliyor…' : isSeenBy(otherReadAt, m.created_at) ? <span className="text-gold">Görüldü</span> : 'Gönderildi'}
                  </div>
                )}
              </Fragment>
            )
          })
        )}
        {otherTyping && (
          <div className="flex items-center gap-2 self-start rounded-[14px] rounded-bl-[4px] border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-muted" aria-live="polite">
            <span className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" />
            </span>
            {participant.fullName.split(' ')[0]} yazıyor…
          </div>
        )}
      </div>

      <Composer
        onSend={send}
        onTyping={notifyTyping}
        onFileSelect={upload}
        disabled={isSending || !!closedNotice || blockedByThem || blockedByMe || restricted}
        notice={notice}
      />

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        participant={participant}
        currentUserId={currentUserId}
        onBlockChange={() => setBlockCheck((n) => n + 1)}
      />
    </section>
  )
}
