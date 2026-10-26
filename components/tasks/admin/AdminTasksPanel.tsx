'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ExternalLink, Gift, Pencil, Plus, X } from 'lucide-react'
import type { AdminSubmissionView, AdminTasksDashboard } from '@/lib/tasks'
import {
  TASK_AUDIENCE_LABELS,
  TASK_KIND_LABELS,
  TASK_REWARD_STATUS_LABELS,
  type TaskRewardStatus,
} from '@/lib/tasks-shared'
import { applyPendingRewards, cancelReward, reviewSubmission, setPromoPeriod } from '@/app/admin/tasks/actions'
import TaskEditor, { type EditableTask } from '@/components/tasks/admin/TaskEditor'
import { Button, Card, CardBody, CardHeader, Chip, ConfirmDialog, EmptyState, Field, Modal, PageHeader, StatCard, Switch, Tabs, Textarea } from '@/components/ui'

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const formatCount = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('tr-TR') : '—')
const REWARD_TONE: Record<TaskRewardStatus, 'warning' | 'success' | 'neutral'> = { pending: 'warning', applied: 'success', cancelled: 'neutral' }

function personLabel(user: AdminSubmissionView['user']) {
  return user.fullName || (user.username ? `@${user.username}` : user.id.slice(0, 8))
}

function SubmissionCard({
  item,
  onApprove,
  onReject,
  busy,
}: {
  item: AdminSubmissionView
  onApprove?: () => void
  onReject?: () => void
  busy: boolean
}) {
  return (
    <Card padded className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">{item.taskTitle}</p>
          <p className="text-[12.5px] text-ink-muted">
            {personLabel(item.user)}
            {item.user.username ? ` · @${item.user.username}` : ''} · Tur {item.round} · {formatDate(item.createdAt)}
          </p>
        </div>
        <Chip tone="gold">{item.reward}</Chip>
      </div>

      <div className="grid gap-1.5 text-[13px] text-ink-muted">
        {item.postUrl && (
          <a href={item.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-ink hover:text-gold">
            <ExternalLink className="h-3.5 w-3.5 flex-none" /> {item.postUrl}
          </a>
        )}
        {item.taskKind === 'promo_video' && (
          <p>
            {item.status === 'measuring'
              ? `Ölçüm: ${formatDate(item.measureDueAt)} · gereken izlenme ${formatCount(item.requiredViews)} (takipçi ${formatCount(item.followersAtSubmit)})`
              : `İzlenme ${formatCount(item.measuredViews)} / ${formatCount(item.requiredViews)} · beğeni ${formatCount(item.measuredLikes)} · takipçi ${formatCount(item.followersAtSubmit)}`}
          </p>
        )}
        {item.hasAdTag !== null && (
          <div>
            <Chip tone={item.hasAdTag ? 'success' : 'warning'} dot>
              {item.hasAdTag ? 'Reklam etiketi var' : 'Reklam etiketi bulunamadı'}
            </Chip>
          </div>
        )}
        {item.checkNote && <p className="text-ink">{item.checkNote}</p>}
        {item.proofUrl && (
          <a href={item.proofUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
            {/* İmzalı bağlantı (10 dk); next/image dış alan adı listesinde değil. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.proofUrl} alt="Story ekran görüntüsü" className="max-h-80 rounded-lg border border-line object-contain" />
          </a>
        )}
      </div>

      {onApprove && onReject && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" leftIcon={<Check />} onClick={onApprove} disabled={busy}>
            Onayla
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<X />} onClick={onReject} disabled={busy}>
            Reddet
          </Button>
        </div>
      )}
    </Card>
  )
}

/** Görevler (admin): 0₺ dönemi, inceleme kuyruğu, ölçüm bekleyenler, görev tanımları, bekleyen ödüller. */
export default function AdminTasksPanel({ data, extra }: { data: AdminTasksDashboard; extra?: ReactNode }) {
  const router = useRouter()
  const [tab, setTab] = useState<'review' | 'measuring' | 'tasks' | 'rewards'>(data.review.length ? 'review' : 'tasks')
  const [isPending, startTransition] = useTransition()
  const [promoConfirm, setPromoConfirm] = useState<boolean | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [rejecting, setRejecting] = useState<AdminSubmissionView | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [editing, setEditing] = useState<EditableTask | 'new' | null>(null)

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        toast.error(result.error ?? 'İşlem başarısız.')
        return
      }
      if (result.message) toast.success(result.message)
      after?.()
      router.refresh()
    })

  const creatorTasks = useMemo(() => data.tasks.filter((t) => t.audience === 'creator'), [data.tasks])
  const brandTasks = useMemo(() => data.tasks.filter((t) => t.audience === 'brand'), [data.tasks])

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Görevler"
        description="Kullanıcılara görev ver, gönderimleri onayla. Ödüller satış başlayınca hesaplara işlenir (2026-10-18 kararı)."
        actions={
          <Button variant="primary" leftIcon={<Plus />} onClick={() => setEditing('new')}>
            Yeni görev
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="İncelemede" value={data.review.length} />
        <StatCard label="Ölçülüyor" value={data.measuring.length} />
        <StatCard label="Bekleyen ödül" value={data.rewardTotals.pending} />
        <StatCard label="İşlenen ödül" value={data.rewardTotals.applied} />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="0₺ dönemi"
          description={`Şu an ${data.promoPeriod ? 'açık' : 'kapalı'}`}
          action={
            <Switch checked={data.promoPeriod} onChange={(checked) => setPromoConfirm(checked)} disabled={isPending} label="0₺ dönemi" />
          }
        />
        <CardBody className="text-[13px] text-ink-muted">
          Açıkken mavi tik için mevcut şartlara ek olarak onaylanmış tanıtım videosu görevi ve en az 1 tamamlanan iş birliği gerekir; güven
          skorunda Spotlight puanı sayılmaz. Kampanya başlarken aç, satış başlayınca kapat.
        </CardBody>
      </Card>

      {extra}

      <Tabs
        className="mb-4"
        value={tab}
        onSelect={(v) => setTab(v as typeof tab)}
        items={[
          { value: 'review', label: 'İnceleme', count: data.review.length },
          { value: 'measuring', label: 'Ölçülüyor', count: data.measuring.length },
          { value: 'tasks', label: 'Görevler', count: data.tasks.length },
          { value: 'rewards', label: 'Ödüller', count: data.rewardTotals.pending },
        ]}
      />

      {tab === 'review' &&
        (data.review.length === 0 ? (
          <Card>
            <EmptyState icon={Check} title="İncelenecek gönderim yok" />
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.review.map((item) => (
              <SubmissionCard
                key={item.id}
                item={item}
                busy={isPending}
                onApprove={() => run(() => reviewSubmission(item.id, 'approve', null))}
                onReject={() => {
                  setRejectNote('')
                  setRejecting(item)
                }}
              />
            ))}
          </div>
        ))}

      {tab === 'measuring' &&
        (data.measuring.length === 0 ? (
          <Card>
            <EmptyState title="Ölçüm bekleyen video yok" description="Tanıtım videoları bekleme süresi dolunca saatlik görevde ölçülür." />
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.measuring.map((item) => (
              <SubmissionCard key={item.id} item={item} busy={isPending} />
            ))}
          </div>
        ))}

      {tab === 'tasks' && (
        <div className="grid gap-4">
          {[
            { label: TASK_AUDIENCE_LABELS.creator, list: creatorTasks },
            { label: TASK_AUDIENCE_LABELS.brand, list: brandTasks },
          ].map((group) => (
            <Card key={group.label}>
              <CardHeader title={group.label} />
              {group.list.length === 0 ? (
                <CardBody className="text-[13px] text-ink-muted">Görev yok.</CardBody>
              ) : (
                <ul>
                  {group.list.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-ink">
                          {task.title} <Chip tone={task.is_active ? 'success' : 'neutral'}>{task.is_active ? 'Açık' : 'Kapalı'}</Chip>
                        </p>
                        <p className="text-[12.5px] text-ink-muted">
                          {TASK_KIND_LABELS[task.kind]} · {task.max_rounds > 1 ? `${task.max_rounds} tur · ` : ''}
                          {task.target_user_ids?.length ? `${task.target_user_ids.length} hedef kullanıcı · ` : ''}
                          onaylı {task.stats.approved} · incelemede {task.stats.inReview} · ölçülüyor {task.stats.measuring} · ret {task.stats.rejected}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" leftIcon={<Pencil />} onClick={() => setEditing(task)}>
                        Düzenle
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'rewards' && (
        <Card>
          <CardHeader
            title="Ödüller"
            description="Bekleyen ödüller satış başlayınca işlenir: Spotlight süresi hesaba eklenir, indirim kodu kullanılabilir olur. İndirim kodu ilk ay %50 indirimiyle birleşmez."
            action={
              <Button variant="primary" size="sm" leftIcon={<Gift />} disabled={isPending || data.rewardTotals.pending === 0} onClick={() => setApplyOpen(true)}>
                Ödülleri hesaplara işle
              </Button>
            }
          />
          {data.rewards.length === 0 ? (
            <CardBody className="text-[13px] text-ink-muted">Henüz ödül yok.</CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
                    <th className="px-5 py-2.5 font-medium">Kullanıcı</th>
                    <th className="px-3 py-2.5 font-medium">Görev</th>
                    <th className="px-3 py-2.5 font-medium">Ödül</th>
                    <th className="px-3 py-2.5 font-medium">Durum</th>
                    <th className="px-5 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.rewards.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3 text-ink">{personLabel(r.user)}</td>
                      <td className="px-3 py-3 text-ink-muted">{r.taskTitle}</td>
                      <td className="px-3 py-3 text-ink">
                        {r.text}
                        {r.code ? <span className="ml-1.5 font-mono text-[12px] text-ink-muted">{r.code}</span> : null}
                        {r.appliedUntil ? <span className="block text-[12px] text-ink-muted">Bitiş: {formatDate(r.appliedUntil)}</span> : null}
                      </td>
                      <td className="px-3 py-3">
                        <Chip tone={REWARD_TONE[r.status]}>{TASK_REWARD_STATUS_LABELS[r.status]}</Chip>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.status === 'pending' && (
                          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => cancelReward(r.id))}>
                            İptal
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={promoConfirm !== null}
        onClose={() => setPromoConfirm(null)}
        onConfirm={() => run(() => setPromoPeriod(promoConfirm === true), () => setPromoConfirm(null))}
        loading={isPending}
        tone={promoConfirm ? 'danger' : 'primary'}
        title={promoConfirm ? '0₺ dönemi açılsın mı?' : '0₺ dönemi kapatılsın mı?'}
        description={
          promoConfirm
            ? 'Mavi tik için ek şartlar başlar; şartları sağlamayan influencerların mavi tiki hemen kaldırılır.'
            : 'Mavi tik yeniden yalnızca mevcut kurala göre verilir.'
        }
        confirmLabel={promoConfirm ? 'Aç' : 'Kapat'}
      />

      <ConfirmDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onConfirm={() => run(() => applyPendingRewards(), () => setApplyOpen(false))}
        loading={isPending}
        tone="danger"
        title="Bekleyen ödüller işlensin mi?"
        description={`${data.rewardTotals.pending} ödül hesaplara işlenecek: Spotlight süreleri eklenir, indirim kodları kullanılabilir olur. Bunu satış (POS) başladığında ve 0₺ dönemi bittikten sonra yap; geri alınamaz.`}
        confirmLabel="İşle"
      />

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        dismissible={!isPending}
        title="Gönderimi reddet"
        description={rejecting ? `${rejecting.taskTitle} · ${personLabel(rejecting.user)}` : undefined}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(null)} disabled={isPending}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={isPending}
              onClick={() => rejecting && run(() => reviewSubmission(rejecting.id, 'reject', rejectNote), () => setRejecting(null))}
            >
              Reddet
            </Button>
          </>
        }
      >
        <Field label="Neden (kullanıcıya gösterilir)">
          {(props) => <Textarea {...props} rows={3} maxLength={500} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />}
        </Field>
      </Modal>

      {editing && <TaskEditor task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />}
    </div>
  )
}
