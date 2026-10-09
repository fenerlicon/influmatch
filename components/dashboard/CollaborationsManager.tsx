'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { collaborationAction } from '@/app/dashboard/collaborations/actions'
import {
  AUTO_COMPLETE_DAYS,
  COLLABORATION_STATUS_LABELS,
  type CollaborationAction,
  type CollaborationStatus,
} from '@/lib/collaboration-shared'
import type { CollaborationListItem } from '@/lib/collaborations'

interface Props {
  initialItems: CollaborationListItem[]
  currentUserId: string
  role: 'brand' | 'influencer'
}

type Filter = 'all' | 'active' | CollaborationStatus

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'active', label: 'Süren' },
  { value: 'all', label: 'Tümü' },
  { value: 'agreed', label: COLLABORATION_STATUS_LABELS.agreed },
  { value: 'in_progress', label: COLLABORATION_STATUS_LABELS.in_progress },
  { value: 'published', label: COLLABORATION_STATUS_LABELS.published },
  { value: 'completed', label: COLLABORATION_STATUS_LABELS.completed },
  { value: 'cancelled', label: COLLABORATION_STATUS_LABELS.cancelled },
]

const STATUS_STYLES: Record<CollaborationStatus, string> = {
  agreed: 'text-sky-200 border-sky-400/60 bg-sky-400/10',
  in_progress: 'text-yellow-200 border-yellow-400/60 bg-yellow-400/10',
  published: 'text-purple-200 border-purple-400/60 bg-purple-400/10',
  completed: 'text-emerald-200 border-emerald-400/60 bg-emerald-400/10',
  cancelled: 'text-red-200 border-red-400/60 bg-red-400/10',
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : null

export default function CollaborationsManager({ initialItems, currentUserId, role }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('active')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [publishDrafts, setPublishDrafts] = useState<Record<string, string>>({})
  const [openForm, setOpenForm] = useState<{ id: string; kind: 'publish' | 'cancel' } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [, startTransition] = useTransition()

  // Karşı taraf bir işlem yaptığında liste yenilenir (RLS yalnızca kendi kayıtlarının olaylarını gönderir).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const column = role === 'brand' ? 'brand_id' : 'influencer_id'
    const channel = supabase
      .channel(`collaborations-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collaborations', filter: `${column}=eq.${currentUserId}` }, () =>
        router.refresh(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, role, router])

  const items = useMemo(() => {
    if (filter === 'all') return initialItems
    if (filter === 'active') return initialItems.filter((c) => ['agreed', 'in_progress', 'published'].includes(c.status))
    return initialItems.filter((c) => c.status === filter)
  }, [initialItems, filter])

  const run = (item: CollaborationListItem, action: CollaborationAction, extra: { url?: string; reason?: string } = {}) => {
    setBusyId(item.id)
    setMessage(null)
    startTransition(async () => {
      const result = await collaborationAction(item.id, { action, ...extra })
      setBusyId(null)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setOpenForm(null)
      setCancelReason('')
      if (action === 'open_room' && result.roomId) {
        router.push(`/dashboard/messages?roomId=${result.roomId}`)
        return
      }
      const texts: Partial<Record<CollaborationAction, string>> = {
        start: 'İş birliği "İçerik hazırlanıyor" olarak işaretlendi.',
        publish: 'Yayın linki gönderildi. Marka onayladığında iş birliği tamamlanır.',
        approve: 'İş birliği tamamlandı.',
        cancel: 'İş birliği iptal edildi.',
      }
      setMessage({ type: 'success', text: texts[action] ?? 'Kaydedildi.' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              filter === f.value ? 'border-soft-gold bg-soft-gold/10 text-soft-gold' : 'border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-sm text-gray-300">
          {initialItems.length === 0
            ? role === 'brand'
              ? 'Henüz iş birliğiniz yok. Bir teklif kabul edildiğinde veya bir ilan başvurusunu kabul ettiğinizde burada görünür.'
              : 'Henüz iş birliğiniz yok. Bir teklifi kabul ettiğinizde veya ilan başvurunuz kabul edildiğinde burada görünür.'
            : 'Bu filtrede iş birliği yok.'}
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const busy = busyId === item.id
            const other = item.other
            const otherName = other?.full_name || (other?.username ? `@${other.username}` : 'Kullanıcı')
            const showPublishForm = openForm?.id === item.id && openForm.kind === 'publish'
            const showCancelForm = openForm?.id === item.id && openForm.kind === 'cancel'
            return (
              <li key={item.id} className="rounded-3xl border border-white/10 bg-[#0F1014] p-5 text-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {other?.avatar_url ? (
                        <Image src={other.avatar_url} alt={otherName} fill sizes="48px" className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-soft-gold">{otherName[0]}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{item.title}</p>
                      <p className="truncate text-sm text-gray-400">
                        {other?.username ? (
                          <Link href={`/profile/${other.username}`} className="hover:text-soft-gold">
                            {otherName}
                          </Link>
                        ) : (
                          otherName
                        )}
                        <span className="text-gray-500"> · {item.source === 'offer' ? 'Teklif' : 'İlan başvurusu'}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[item.status]}`}>
                    {COLLABORATION_STATUS_LABELS[item.status]}
                  </span>
                </div>

                <dl className="mt-4 grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
                  <div>
                    <dt className="inline">Anlaşma: </dt>
                    <dd className="inline text-gray-200">{formatDate(item.created_at)}</dd>
                  </div>
                  {item.published_at && (
                    <div>
                      <dt className="inline">Yayın linki: </dt>
                      <dd className="inline text-gray-200">{formatDate(item.published_at)}</dd>
                    </div>
                  )}
                  {item.completed_at && (
                    <div>
                      <dt className="inline">Tamamlandı: </dt>
                      <dd className="inline text-gray-200">
                        {formatDate(item.completed_at)}
                        {item.auto_completed ? ' (otomatik)' : ''}
                      </dd>
                    </div>
                  )}
                  {item.cancelled_at && (
                    <div>
                      <dt className="inline">İptal: </dt>
                      <dd className="inline text-gray-200">
                        {formatDate(item.cancelled_at)} · {item.cancelled_by === currentUserId ? 'sizin tarafınızdan' : 'karşı tarafça'}
                      </dd>
                    </div>
                  )}
                  {item.auto_complete_at && (
                    <div className="sm:col-span-2">
                      {role === 'brand'
                        ? `Onaylamazsanız ${formatDate(item.auto_complete_at)} tarihinde otomatik tamamlanır (${AUTO_COMPLETE_DAYS} gün).`
                        : `Marka yanıt vermezse ${formatDate(item.auto_complete_at)} tarihinde otomatik tamamlanır.`}
                    </div>
                  )}
                </dl>

                {item.cancel_reason && <p className="mt-2 text-xs text-gray-400">İptal gerekçesi: {item.cancel_reason}</p>}

                <p className="mt-2 text-xs text-gray-400">
                  Anlaşma özeti:{' '}
                  <span className="text-gray-200">
                    {item.agreement_state === 'confirmed' ? 'iki taraf onayladı' : item.agreement_state === 'pending' ? 'onay bekliyor' : 'hazırlanmadı'}
                  </span>
                  {item.deliverable_total > 0 && (
                    <>
                      {' · '}Teslimat: <span className="text-gray-200">{item.deliverable_published} / {item.deliverable_total} yayınlandı</span>
                    </>
                  )}
                </p>

                {item.publish_url && (
                  <a
                    href={item.publish_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-3 inline-block max-w-full truncate text-sm text-soft-gold underline-offset-2 hover:underline"
                  >
                    {item.publish_url}
                  </a>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/collaborations/${item.id}`}
                    className="rounded-xl border border-soft-gold/40 bg-soft-gold/10 px-4 py-2 text-xs font-semibold text-soft-gold transition hover:bg-soft-gold/20"
                  >
                    Ayrıntılar ve teslimatlar
                  </Link>
                  {item.room_id ? (
                    <Link
                      href={`/dashboard/messages?roomId=${item.room_id}`}
                      className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-200 transition hover:border-soft-gold hover:text-soft-gold"
                    >
                      Sohbete git
                    </Link>
                  ) : (
                    item.actions.includes('open_room') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(item, 'open_room')}
                        className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-200 transition hover:border-soft-gold hover:text-soft-gold disabled:opacity-50"
                      >
                        Sohbeti aç
                      </button>
                    )
                  )}
                  {item.actions.includes('start') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(item, 'start')}
                      className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-100 transition hover:bg-yellow-400/20 disabled:opacity-50"
                    >
                      İçerik hazırlanıyor
                    </button>
                  )}
                  {item.actions.includes('publish') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setOpenForm(showPublishForm ? null : { id: item.id, kind: 'publish' })}
                      className="rounded-xl border border-purple-400/40 bg-purple-400/10 px-4 py-2 text-xs font-semibold text-purple-100 transition hover:bg-purple-400/20 disabled:opacity-50"
                    >
                      Yayın linkini gir
                    </button>
                  )}
                  {item.actions.includes('approve') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(item, 'approve')}
                      className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      Onayla ve tamamla
                    </button>
                  )}
                  {item.actions.includes('cancel') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setOpenForm(showCancelForm ? null : { id: item.id, kind: 'cancel' })}
                      className="rounded-xl border border-red-400/30 px-4 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
                    >
                      İptal et
                    </button>
                  )}
                </div>

                {showPublishForm && (
                  <form
                    className="mt-4 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault()
                      run(item, 'publish', { url: publishDrafts[item.id] ?? '' })
                    }}
                  >
                    <input
                      type="url"
                      inputMode="url"
                      required
                      maxLength={500}
                      placeholder="https://www.instagram.com/p/..."
                      value={publishDrafts[item.id] ?? ''}
                      onChange={(e) => setPublishDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-soft-gold/50"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-soft-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-soft-gold/90 disabled:opacity-50"
                    >
                      Gönder
                    </button>
                  </form>
                )}
                {showPublishForm && <p className="mt-1 text-xs text-gray-500">Instagram, TikTok veya YouTube linki.</p>}

                {showCancelForm && (
                  <form
                    className="mt-4 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      run(item, 'cancel', { reason: cancelReason })
                    }}
                  >
                    <textarea
                      maxLength={500}
                      rows={2}
                      placeholder="Gerekçe (isteğe bağlı, karşı tarafa iletilir)"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-red-400/50"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-red-500/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      İş birliğini iptal et
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
