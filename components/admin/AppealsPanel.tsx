'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ExternalLink, Gavel, Paperclip, X } from 'lucide-react'
import { getAppealAttachment, resolveAppeal } from '@/app/admin/appeals/actions'
import { Button, Card, CardBody, CardHeader, Chip, ConfirmDialog, EmptyState, Field, PageHeader, Segmented, Tabs, Textarea, type ChipTone } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { AdminAppealView } from '@/lib/moderation'
import {
  APPEAL_RESPONSE_MAX,
  APPEAL_STATUS_LABELS,
  MODERATION_SUBJECT_LABELS,
  MODERATION_SUBJECT_TYPES,
  type AppealStatus,
  type ModerationSubjectType,
} from '@/lib/moderation-shared'

const STATUS_TONE: Record<AppealStatus, ChipTone> = { open: 'warning', accepted: 'success', rejected: 'danger' }
const OUTCOME_TEXT: Record<string, string> = {
  reopened: 'Kayıt yeniden incelemeye alındı.',
  unchanged: 'Kayıt o sırada reddedilmiş durumda değildi; değişiklik yapılmadı.',
  rejected: 'Karar aynen kaldı.',
}
const ACCOUNT_STATUS: Record<string, string> = { pending: 'Bekliyor', verified: 'Onaylı', rejected: 'Reddedildi' }

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function hrefFor(status: string, type: string) {
  const params = new URLSearchParams()
  if (status !== 'open') params.set('durum', status)
  if (type !== 'all') params.set('tur', type)
  const q = params.toString()
  return `/admin/appeals${q ? `?${q}` : ''}`
}

function AppealDetail({ item, onClose }: { item: AdminAppealView; onClose: () => void }) {
  const router = useRouter()
  const [response, setResponse] = useState('')
  const [confirm, setConfirm] = useState<'accept' | 'reject' | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = (action: 'accept' | 'reject') =>
    startTransition(async () => {
      const result = await resolveAppeal(item.id, action, response)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? 'Kaydedildi.')
      setConfirm(null)
      router.refresh()
    })

  const openAttachment = () =>
    startTransition(async () => {
      const result = await getAppealAttachment(item.id)
      if (!result.success) toast.error(result.error)
      else if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer')
    })

  const open = item.status === 'open'

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {item.decision.subjectLabel} itirazı
            <Chip tone={STATUS_TONE[item.status]} dot>
              {APPEAL_STATUS_LABELS[item.status]}
            </Chip>
          </span>
        }
        description={formatDate(item.createdAt)}
        action={
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Kapat" leftIcon={<X />}>
            Kapat
          </Button>
        }
      />
      <CardBody className="grid gap-4 text-[13px]">
        <section className="grid gap-1">
          <h3 className="text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">Kullanıcı</h3>
          <p className="text-ink">
            {item.user.name}
            {item.user.username ? <span className="text-ink-faint"> · @{item.user.username}</span> : null}
          </p>
          <p className="text-ink-muted">
            {item.user.email ?? '—'} · {item.user.role === 'brand' ? 'Marka' : item.user.role === 'influencer' ? 'Influencer' : '—'} · Hesap:{' '}
            {ACCOUNT_STATUS[item.user.verificationStatus ?? ''] ?? '—'}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href={`/admin?ara=${item.user.id}`} className="inline-flex items-center gap-1 text-gold hover:underline">
              Kullanıcı kartı <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
            {item.user.username && (
              <Link href={`/profile/${item.user.username}`} className="inline-flex items-center gap-1 text-gold hover:underline">
                Profil <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
            {item.decision.subjectType === 'task_submission' && (
              <Link href="/admin/tasks" className="inline-flex items-center gap-1 text-gold hover:underline">
                Görevler <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>
        </section>

        <section className="grid gap-1 rounded-xl border border-line bg-surface-2 p-3">
          <h3 className="text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">Asıl karar</h3>
          <p className="text-ink">
            <span className="font-medium">Neden:</span> {item.decision.reason}
          </p>
          {item.decision.subjectSummary && <p className="break-words text-ink-muted">{item.decision.subjectSummary}</p>}
          <p className="text-xs text-ink-faint">
            {formatDate(item.decision.decidedAt)}
            {item.decision.decidedBy ? ` · ${item.decision.decidedBy}` : ''}
            {' · '}
            {item.decision.current ? 'Kayıt hâlâ bu kararla reddedilmiş' : 'Kayıt artık bu kararla reddedilmiş durumda değil'}
          </p>
        </section>

        <section className="grid gap-1.5">
          <h3 className="text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">İtiraz metni</h3>
          <p className="whitespace-pre-line text-ink">{item.message}</p>
          {item.hasAttachment && (
            <div>
              <Button size="sm" variant="secondary" leftIcon={<Paperclip />} onClick={openAttachment} loading={isPending}>
                Eki aç
              </Button>
            </div>
          )}
        </section>

        {open ? (
          <section className="grid gap-3">
            <Field label="Yanıt (kullanıcıya gösterilir; reddederken zorunlu)" hint={`${response.length} / ${APPEAL_RESPONSE_MAX}`}>
              {(props) => (
                <Textarea {...props} rows={3} maxLength={APPEAL_RESPONSE_MAX} value={response} onChange={(e) => setResponse(e.target.value)} />
              )}
            </Field>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
              <span className="font-medium text-ink">Kabul edersen:</span> {item.acceptEffect}
              {!item.decision.current && ' Kayıt şu an bu kararla reddedilmiş olmadığından değişiklik yapılmaz, yalnızca kullanıcıya bildirilir.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" leftIcon={<Check />} disabled={isPending} onClick={() => setConfirm('accept')}>
                Kabul et
              </Button>
              <Button variant="danger" size="sm" leftIcon={<X />} disabled={isPending || response.trim().length < 3} onClick={() => setConfirm('reject')}>
                Reddet
              </Button>
            </div>
          </section>
        ) : (
          <section className="grid gap-1 rounded-xl border border-line p-3">
            <h3 className="text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">Sonuç</h3>
            <p className="text-ink">{item.response ? item.response : <span className="text-ink-faint">Yanıt yazılmadı.</span>}</p>
            {item.outcome && OUTCOME_TEXT[item.outcome] && <p className="text-ink-muted">{OUTCOME_TEXT[item.outcome]}</p>}
            <p className="text-xs text-ink-faint">
              {formatDate(item.resolvedAt)}
              {item.resolvedBy ? ` · ${item.resolvedBy}` : ''}
            </p>
          </section>
        )}
      </CardBody>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => !isPending && setConfirm(null)}
        onConfirm={() => confirm && run(confirm)}
        loading={isPending}
        tone={confirm === 'reject' ? 'danger' : 'primary'}
        title={confirm === 'accept' ? 'İtiraz kabul edilsin mi?' : 'İtiraz reddedilsin mi?'}
        description={
          confirm === 'accept'
            ? `${item.acceptEffect} Kullanıcıya bildirim gider.`
            : 'Karar aynen kalır; kullanıcı yanıtını görür ve bu karara yeniden itiraz edemez.'
        }
        confirmLabel={confirm === 'accept' ? 'Kabul et' : 'Reddet'}
      />
    </Card>
  )
}

/** İtirazlar (admin): liste (durum / tür filtresi) + seçilen itirazın ayrıntısı ve kararı. */
export default function AppealsPanel({
  appeals,
  counts,
  status,
  type,
}: {
  appeals: AdminAppealView[]
  counts: Record<AppealStatus, number>
  status: AppealStatus | 'all'
  type: ModerationSubjectType | 'all'
}) {
  const [selectedId, setSelectedId] = useState<string | null>(appeals[0]?.id ?? null)
  const selected = appeals.find((a) => a.id === selectedId) ?? null
  const total = counts.open + counts.accepted + counts.rejected

  return (
    <div className="max-w-[1320px]">
      <PageHeader
        title="İtirazlar"
        description="Kullanıcıların ret kararlarına (hesap onayı, vergi levhası, görev gönderimi) itirazları. Karar başına bir itiraz yapılabilir."
      />

      <Tabs
        className="mb-3"
        label="İtiraz durumu"
        value={status}
        items={[
          { value: 'open', label: 'Açık', count: counts.open, href: hrefFor('open', type) },
          { value: 'accepted', label: 'Kabul edilen', count: counts.accepted, href: hrefFor('accepted', type) },
          { value: 'rejected', label: 'Reddedilen', count: counts.rejected, href: hrefFor('rejected', type) },
          { value: 'all', label: 'Tümü', count: total, href: hrefFor('all', type) },
        ]}
      />
      <Segmented
        className="mb-4"
        label="Karar türü"
        value={type}
        items={[
          { value: 'all', label: 'Tüm türler', href: hrefFor(status, 'all') },
          ...MODERATION_SUBJECT_TYPES.map((t) => ({ value: t, label: MODERATION_SUBJECT_LABELS[t], href: hrefFor(status, t) })),
        ]}
      />

      <div className={cn('grid items-start gap-4', selected && 'lg:grid-cols-[minmax(0,1fr)_460px]')}>
        <Card className={cn('overflow-hidden', selected && 'order-2 lg:order-none')}>
          {appeals.length === 0 ? (
            <EmptyState icon={Gavel} title="İtiraz yok" description={status === 'open' ? 'Yanıt bekleyen itiraz bulunmuyor.' : 'Bu filtrede itiraz bulunmuyor.'} />
          ) : (
            <ul>
              {appeals.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                    aria-pressed={a.id === selectedId}
                    className={cn(
                      'grid w-full gap-1 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface-2',
                      a.id === selectedId && 'bg-surface-2 shadow-[inset_2px_0_0_theme(colors.gold.DEFAULT)]',
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <span className="font-medium text-ink">{a.user.name}</span>
                      <Chip>{a.decision.subjectLabel}</Chip>
                      <Chip tone={STATUS_TONE[a.status]} dot>
                        {APPEAL_STATUS_LABELS[a.status]}
                      </Chip>
                      <span className="ml-auto text-xs text-ink-faint">{formatDate(a.createdAt)}</span>
                    </span>
                    <span className="truncate text-[12.5px] text-ink-muted">Neden: {a.decision.reason}</span>
                    <span className="line-clamp-2 text-[12.5px] text-ink-faint">{a.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && (
          <div className="order-1 lg:order-none">
            <AppealDetail key={selected.id} item={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  )
}
