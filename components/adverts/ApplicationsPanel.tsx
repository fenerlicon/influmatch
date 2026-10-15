'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Inbox, MessageSquare, Star, Undo2 } from 'lucide-react'
import { getOrCreateAdvertApplicationRoom, updateApplicationStatus } from '@/app/dashboard/brand/advert/actions'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { countUnreadInRoom } from '@/lib/unread-messages'
import { worksHref, COLLABORATION_TONES } from '@/lib/works'
import { APPLICATION_STATUS, formatExpectation, relativeDay, type AdvertApplication, type ApplicationStatus } from '@/lib/adverts-shared'
import { Avatar, Button, ButtonLink, Card, CardHeader, Chip, ConfirmDialog, EmptyState, Segmented, VerifiedTick } from '@/components/ui'
import { COLLABORATION_STAGE_SHORT_LABELS, collaborationDetailHref } from '@/lib/collaboration-shared'

type Filter = 'new' | 'shortlisted' | 'reviewed'
const FILTER_OF: Record<ApplicationStatus, Filter> = { pending: 'new', shortlisted: 'shortlisted', accepted: 'reviewed', rejected: 'reviewed' }

interface Props {
  advertTitle: string
  applications: AdvertApplication[]
  currentUserId: string
}

/** Seçili ilanın başvuruları: ön liste, reddet, kabul et (kabul iş birliği başlatır), mesaj. */
export default function ApplicationsPanel({ advertTitle, applications, currentUserId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(applications)
  const [filter, setFilter] = useState<Filter>('new')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ app: AdvertApplication; status: 'accepted' | 'rejected' } | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [, startTransition] = useTransition()

  useEffect(() => setItems(applications), [applications])

  // Okunmamış mesaj sayısı (başvuru sohbeti açılmışsa).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let cancelled = false
    Promise.all(
      applications.filter((a) => a.room_id).map(async (a) => [a.id, await countUnreadInRoom(supabase, a.room_id!, currentUserId).catch(() => 0)] as const),
    ).then((pairs) => {
      if (!cancelled) setUnread(Object.fromEntries(pairs.filter(([, n]) => n > 0)))
    })
    return () => {
      cancelled = true
    }
  }, [applications, currentUserId])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { new: 0, shortlisted: 0, reviewed: 0 }
    items.forEach((a) => c[FILTER_OF[a.status] ?? 'new']++)
    return c
  }, [items])

  // Yeni başvuru yoksa ilk dolu sekmeye geç (ilan değişince).
  useEffect(() => {
    setFilter((current) => (counts[current] > 0 ? current : counts.new ? 'new' : counts.shortlisted ? 'shortlisted' : counts.reviewed ? 'reviewed' : 'new'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertTitle])

  const visible = items.filter((a) => (FILTER_OF[a.status] ?? 'new') === filter)

  const setStatus = (app: AdvertApplication, status: ApplicationStatus) => {
    setBusyId(app.id)
    startTransition(async () => {
      const result = await updateApplicationStatus(app.id, status)
      setBusyId(null)
      setConfirm(null)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setItems((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)))
      const text: Record<ApplicationStatus, string> = {
        accepted: 'Başvuru kabul edildi. İş, İşler sayfasında başladı.',
        shortlisted: 'Ön listeye alındı.',
        rejected: 'Başvuru reddedildi.',
        pending: 'Başvuru yeniden beklemede.',
      }
      toast.success(text[status])
      router.refresh()
    })
  }

  const openChat = (app: AdvertApplication) => {
    setBusyId(app.id)
    startTransition(async () => {
      const result = await getOrCreateAdvertApplicationRoom(app.id)
      setBusyId(null)
      if (result.success && result.roomId) router.push(`/dashboard/messages?roomId=${result.roomId}`)
      else toast.error(result.error ?? 'Sohbet açılamadı.')
    })
  }

  return (
    <Card as="section" className="overflow-hidden">
      <CardHeader
        title={`Başvurular · ${advertTitle}`}
        description="Kabul ettiğinde sohbet açılır ve iş İşler sayfasında başlar."
        action={
          <Segmented
            label="Başvuru filtresi"
            value={filter}
            onSelect={(v) => setFilter(v as Filter)}
            items={[
              { value: 'new', label: `Yeni ${counts.new}` },
              { value: 'shortlisted', label: `Ön liste ${counts.shortlisted}` },
              { value: 'reviewed', label: `Değerlendirilen ${counts.reviewed}` },
            ]}
          />
        }
      />
      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={items.length === 0 ? 'Henüz başvuru yok' : 'Bu sekmede başvuru yok'}
          description={items.length === 0 ? 'İlan yayındayken gelen başvurular burada görünür; yeni başvuruda bildirim alırsın.' : undefined}
        />
      ) : (
        visible.map((app) => {
          const inf = app.influencer
          const name = inf.full_name || (inf.username ? `@${inf.username}` : 'Influencer')
          const busy = busyId === app.id
          const status = APPLICATION_STATUS[app.status] ?? APPLICATION_STATUS.pending
          const expectation = formatExpectation(app.budget_expectation)
          const unreadCount = unread[app.id] ?? 0
          return (
            <div key={app.id} className="grid grid-cols-[auto_1fr] items-start gap-3.5 border-b border-line px-5 py-4 last:border-b-0 md:grid-cols-[auto_1fr_auto]">
              <Avatar name={name} src={inf.avatar_url} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-semibold text-ink">{name}</b>
                  {inf.displayed_badges?.includes('verified-account') && <VerifiedTick />}
                  {filter === 'reviewed' &&
                    (app.status === 'accepted' && app.collaboration ? (
                      <Chip tone={COLLABORATION_TONES[app.collaboration.status]} dot>
                        {COLLABORATION_STAGE_SHORT_LABELS[app.collaboration.status]}
                      </Chip>
                    ) : (
                      <Chip tone={status.tone} dot>
                        {status.label}
                      </Chip>
                    ))}
                  <span className="text-xs text-ink-faint">· {relativeDay(app.created_at)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                  {inf.username && <span>@{inf.username}</span>}
                  {app.deliverable_idea && (
                    <span>
                      Teslimat <b className="font-medium text-ink-muted">{app.deliverable_idea}</b>
                    </span>
                  )}
                  {expectation && (
                    <span>
                      Beklenti <b className="font-medium text-ink-muted">{expectation}</b>
                    </span>
                  )}
                </div>
                {app.cover_letter && (
                  <p className="mt-2 whitespace-pre-line rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink-muted">{app.cover_letter}</p>
                )}
              </div>
              <div className="col-span-2 flex flex-wrap justify-end gap-1.5 md:col-span-1">
                {inf.username && (
                  <ButtonLink size="sm" variant="ghost" href={`/profile/${inf.username}`}>
                    Profil
                  </ButtonLink>
                )}
                <Button size="sm" variant="ghost" leftIcon={<MessageSquare />} disabled={busy} onClick={() => openChat(app)}>
                  Mesaj{unreadCount > 0 && <span className="rounded-full bg-gold px-1.5 text-[10.5px] font-semibold text-gold-ink">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </Button>
                {app.status === 'pending' && (
                  <Button size="sm" leftIcon={<Star />} disabled={busy} onClick={() => setStatus(app, 'shortlisted')}>
                    Ön liste
                  </Button>
                )}
                {app.status === 'shortlisted' && (
                  <Button size="sm" variant="ghost" leftIcon={<Undo2 />} disabled={busy} onClick={() => setStatus(app, 'pending')}>
                    Listeden çıkar
                  </Button>
                )}
                {(app.status === 'pending' || app.status === 'shortlisted') && (
                  <>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ app, status: 'rejected' })}>
                      Reddet
                    </Button>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => setConfirm({ app, status: 'accepted' })}>
                      Kabul et
                    </Button>
                  </>
                )}
                {app.status === 'rejected' && (
                  <Button size="sm" variant="ghost" leftIcon={<Undo2 />} disabled={busy} onClick={() => setStatus(app, 'pending')}>
                    Reddi geri al
                  </Button>
                )}
                {app.status === 'accepted' && (
                  <ButtonLink size="sm" href={app.collaboration ? collaborationDetailHref(app.collaboration.id) : worksHref('active')}>
                    {app.collaboration ? 'İş birliğine git' : 'İşe git'}
                  </ButtonLink>
                )}
              </div>
            </div>
          )
        })
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && setStatus(confirm.app, confirm.status)}
        loading={!!confirm && busyId === confirm.app.id}
        tone={confirm?.status === 'rejected' ? 'danger' : 'primary'}
        title={confirm?.status === 'accepted' ? 'Başvuru kabul edilsin mi?' : 'Başvuru reddedilsin mi?'}
        description={
          confirm?.status === 'accepted'
            ? 'Sohbet açılır, iş İşler sayfasında "Anlaşıldı" aşamasıyla başlar ve influencer\'a bildirim gider.'
            : 'Influencer\'a başvurusunun olumsuz sonuçlandığı bildirilir. Gerekirse sonra geri alabilirsin.'
        }
        confirmLabel={confirm?.status === 'accepted' ? 'Kabul et' : 'Reddet'}
      />
    </Card>
  )
}
