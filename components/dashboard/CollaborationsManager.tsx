'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Briefcase, MessageSquare } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { collaborationAction } from '@/app/dashboard/collaborations/actions'
import { AUTO_COMPLETE_DAYS, COLLABORATION_STATUS_LABELS, type CollaborationAction } from '@/lib/collaboration-shared'
import type { CollaborationListItem } from '@/lib/collaborations'
import { ACTIVE_COLLAB_STATUSES, COLLABORATION_TONES, collaborationNextStep, formatShortDate } from '@/lib/works'
import { Avatar, Button, ButtonLink, Card, Chip, EmptyState, Field, Input, ListRow, Modal, Textarea } from '@/components/ui'

/** İşler sayfasındaki iş birliği aşamaları (teklif aşaması OffersManager / BrandOffersList'te). */
export type CollaborationStage = 'active' | 'agreed' | 'in_progress' | 'published' | 'done'

interface Props {
  initialItems: CollaborationListItem[]
  currentUserId: string
  role: 'brand' | 'influencer'
  stage: CollaborationStage
}

export default function CollaborationsManager({ initialItems, currentUserId, role, stage }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ item: CollaborationListItem; kind: 'publish' | 'cancel' } | null>(null)
  const [publishUrl, setPublishUrl] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
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
    if (stage === 'active') return initialItems.filter((c) => ACTIVE_COLLAB_STATUSES.includes(c.status))
    if (stage === 'done') return initialItems.filter((c) => !ACTIVE_COLLAB_STATUSES.includes(c.status))
    return initialItems.filter((c) => c.status === stage)
  }, [initialItems, stage])

  const run = (item: CollaborationListItem, action: CollaborationAction, extra: { url?: string; reason?: string } = {}) => {
    setBusyId(item.id)
    setFormError(null)
    startTransition(async () => {
      const result = await collaborationAction(item.id, { action, ...extra })
      setBusyId(null)
      if (!result.success) {
        if (dialog) setFormError(result.error)
        else toast.error(result.error)
        return
      }
      setDialog(null)
      setPublishUrl('')
      setCancelReason('')
      if (action === 'open_room' && result.roomId) {
        router.push(`/dashboard/messages?roomId=${result.roomId}`)
        return
      }
      const texts: Partial<Record<CollaborationAction, string>> = {
        start: 'İş "İçerik hazırlanıyor" olarak işaretlendi.',
        publish: 'Yayın linki gönderildi. Marka onayladığında iş tamamlanır.',
        approve: 'İş tamamlandı.',
        cancel: 'İş iptal edildi.',
      }
      toast.success(texts[action] ?? 'Kaydedildi.')
      router.refresh()
    })
  }

  if (items.length === 0) {
    const none = initialItems.length === 0
    return (
      <Card>
        <EmptyState
          icon={Briefcase}
          title={none ? 'Henüz iş yok' : 'Bu aşamada iş yok'}
          description={
            none
              ? role === 'brand'
                ? 'Bir teklifin kabul edildiğinde ya da bir ilan başvurusunu kabul ettiğinde iş burada başlar.'
                : 'Bir teklifi kabul ettiğinde ya da ilan başvurun kabul edildiğinde iş burada başlar.'
              : undefined
          }
          action={
            none ? (
              <ButtonLink href={role === 'brand' ? '/dashboard/brand/discover' : '/dashboard/influencer/advert'} size="sm" variant="primary">
                {role === 'brand' ? 'Keşfete git' : 'İlanlara göz at'}
              </ButtonLink>
            ) : undefined
          }
        />
      </Card>
    )
  }

  return (
    <>
      <Card className="overflow-hidden">
        {items.map((item) => {
          const busy = busyId === item.id
          const other = item.other
          const otherName = other?.full_name || (other?.username ? `@${other.username}` : 'Kullanıcı')
          return (
            <ListRow key={item.id} className="items-start py-4">
              <Avatar name={otherName} src={other?.avatar_url} square={role === 'influencer'} />
              <div className="min-w-0 flex-[1_1_200px]">
                <Link href={`/dashboard/collaborations/${item.id}`} className="block truncate text-[13.5px] font-medium text-ink hover:text-gold">
                  {item.title}
                </Link>
                <div className="flex flex-wrap items-center gap-x-1 text-xs text-ink-faint">
                  {other?.username ? (
                    <Link href={`/profile/${other.username}`} className="hover:text-ink">
                      {otherName}
                    </Link>
                  ) : (
                    <span>{otherName}</span>
                  )}
                  <span>· {item.source === 'offer' ? 'Teklif' : 'İlan başvurusu'}</span>
                  <span>· {formatShortDate(item.created_at)}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-ink-muted">{collaborationNextStep(item, role, currentUserId)}</div>
                {item.publish_url && (
                  <a
                    href={item.publish_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-1 block max-w-full truncate text-[12.5px] text-gold underline-offset-2 hover:underline"
                  >
                    {item.publish_url}
                  </a>
                )}
                {item.cancel_reason && <p className="mt-1 text-xs text-ink-faint">Gerekçe: {item.cancel_reason}</p>}
              </div>
              <Chip tone={COLLABORATION_TONES[item.status]} dot>
                {COLLABORATION_STATUS_LABELS[item.status]}
              </Chip>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                {item.room_id ? (
                  <ButtonLink href={`/dashboard/messages?roomId=${item.room_id}`} variant="ghost" size="sm" iconOnly aria-label="Sohbete git">
                    <MessageSquare />
                  </ButtonLink>
                ) : (
                  item.actions.includes('open_room') && (
                    <Button variant="ghost" size="sm" iconOnly aria-label="Sohbeti aç" disabled={busy} onClick={() => run(item, 'open_room')}>
                      <MessageSquare />
                    </Button>
                  )
                )}
                {item.actions.includes('cancel') && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDialog({ item, kind: 'cancel' })}>
                    İptal et
                  </Button>
                )}
                <ButtonLink href={`/dashboard/collaborations/${item.id}`} size="sm">
                  Ayrıntı
                </ButtonLink>
                {item.actions.includes('start') && (
                  <Button variant="primary" size="sm" loading={busy} onClick={() => run(item, 'start')}>
                    İçeriğe başla
                  </Button>
                )}
                {item.actions.includes('publish') && (
                  <Button variant="primary" size="sm" disabled={busy} onClick={() => setDialog({ item, kind: 'publish' })}>
                    Yayın linkini gir
                  </Button>
                )}
                {item.actions.includes('approve') && (
                  <Button variant="primary" size="sm" loading={busy} onClick={() => run(item, 'approve')}>
                    Onayla ve tamamla
                  </Button>
                )}
              </div>
            </ListRow>
          )
        })}
      </Card>

      <Modal
        open={dialog?.kind === 'publish'}
        onClose={() => setDialog(null)}
        title="Yayın linkini gir"
        description={`Marka onaylamazsa ${AUTO_COMPLETE_DAYS} gün sonra iş otomatik tamamlanır.`}
        dismissible={busyId === null}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>
              Vazgeç
            </Button>
            <Button variant="primary" size="sm" loading={busyId !== null} onClick={() => dialog && run(dialog.item, 'publish', { url: publishUrl })}>
              Gönder
            </Button>
          </>
        }
      >
        <Field label="Yayın linki" hint="Instagram, TikTok veya YouTube linki." error={formError}>
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              maxLength={500}
              placeholder="https://www.instagram.com/p/..."
              value={publishUrl}
              onChange={(e) => setPublishUrl(e.target.value)}
            />
          )}
        </Field>
      </Modal>

      <Modal
        open={dialog?.kind === 'cancel'}
        onClose={() => setDialog(null)}
        title="İşi iptal et"
        description="Karşı taraf bildirim alır. Bu işlem geri alınamaz."
        dismissible={busyId === null}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)} data-autofocus>
              Vazgeç
            </Button>
            <Button variant="danger" size="sm" loading={busyId !== null} onClick={() => dialog && run(dialog.item, 'cancel', { reason: cancelReason })}>
              İşi iptal et
            </Button>
          </>
        }
      >
        <Field label="Gerekçe (isteğe bağlı, karşı tarafa iletilir)" error={formError}>
          {(p) => <Textarea {...p} rows={3} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />}
        </Field>
      </Modal>
    </>
  )
}
