'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { toast } from 'sonner'
import { ArrowLeft, Briefcase, MessageSquare, UserRound } from 'lucide-react'
import { isUserBlocked } from '@/app/dashboard/users/block/actions'
import { sendMessage } from '@/app/dashboard/messages/send/actions'
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
export default function ChatThread({ roomId, roomIds, currentUserId, currentUserRole, isSenderVerified, participant, job, initialMessages, onBack }: Props) {
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

  // Birleşik gösterilen bütün odalar okundu sayılır (room_reads).
  useEffect(() => {
    markRoomsRead(supabase, currentUserId, roomsKey ? roomsKey.split(',') : [roomId])
  }, [roomId, roomsKey, currentUserId, messages.length, supabase])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const send = async (content: string) => {
    setIsSending(true)
    const result = await sendMessage(roomId, content)
    setIsSending(false)
    if (!result.success) {
      if (result.error?.includes('engelle') || result.error?.includes('block')) setBlockedByThem(true)
      toast.error(result.error || 'Mesaj gönderilemedi.')
      return
    }
    if (result.data) {
      const msg = result.data as ChatMessage
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    }
  }

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error('Yalnızca görsel gönderebilirsin (PNG, JPEG, WEBP).')
    if (file.size > 5 * 1024 * 1024) return toast.error('Görsel en fazla 5 MB olabilir.')
    setIsSending(true)
    try {
      const path = `${roomId}/${currentUserId}/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('chat-attachments').upload(path, file)
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

  const notice = blockedByThem
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
            return (
              <Fragment key={m.id}>
                {newDay && <div className="my-1.5 self-center text-[11.5px] text-ink-faint">{dayLabel(m.created_at)}</div>}
                <div className={cn('group flex max-w-[84%] items-center gap-1 md:max-w-[64%]', own ? 'self-end' : 'self-start')}>
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
              </Fragment>
            )
          })
        )}
      </div>

      <Composer
        onSend={send}
        onFileSelect={upload}
        disabled={isSending || blockedByThem || blockedByMe || restricted}
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
