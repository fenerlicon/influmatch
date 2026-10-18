'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveTask } from '@/app/admin/tasks/actions'
import {
  BRAND_FIRST_STEPS_DEFAULTS,
  INVITES_DEFAULTS,
  PROMO_VIDEO_DEFAULTS,
  TASK_KINDS,
  TASK_KIND_AUDIENCE,
  TASK_KIND_LABELS,
  TASK_AUDIENCE_LABELS,
  type TaskKind,
  type TaskRow,
} from '@/lib/tasks-shared'
import { Button, Field, Input, Modal, Select, Switch, Textarea } from '@/components/ui'

export type EditableTask = TaskRow

const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

/** Görev oluşturma / düzenleme penceresi (admin). Görev türü yalnızca yeni görevde seçilir. */
export default function TaskEditor({ task, onClose, onSaved }: { task: EditableTask | null; onClose: () => void; onSaved: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'promo_video')
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [rewardType, setRewardType] = useState(task?.reward_type ?? 'spotlight_days')
  const [rewardPlan, setRewardPlan] = useState(task?.reward_plan ?? 'basic')
  const [rewardDays, setRewardDays] = useState(String(task?.reward_days ?? 30))
  const [rewardPercent, setRewardPercent] = useState(String(task?.reward_percent ?? 20))
  const [maxRounds, setMaxRounds] = useState(String(task?.max_rounds ?? 1))
  const [viewRatio, setViewRatio] = useState(String(task?.params?.view_ratio ?? PROMO_VIDEO_DEFAULTS.view_ratio))
  const [minViews, setMinViews] = useState(String(task?.params?.min_views ?? PROMO_VIDEO_DEFAULTS.min_views))
  const [holdDays, setHoldDays] = useState(String(task?.params?.hold_days ?? PROMO_VIDEO_DEFAULTS.hold_days))
  const [perRound, setPerRound] = useState(String(task?.params?.per_round ?? INVITES_DEFAULTS.per_round))
  const [adverts, setAdverts] = useState(String(task?.params?.adverts ?? BRAND_FIRST_STEPS_DEFAULTS.adverts))
  const [offers, setOffers] = useState(String(task?.params?.offers ?? BRAND_FIRST_STEPS_DEFAULTS.offers))
  const [targets, setTargets] = useState((task?.target_user_ids ?? []).join(', '))
  const [isActive, setIsActive] = useState(task?.is_active ?? false)
  const [startsAt, setStartsAt] = useState(toLocalInput(task?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(task?.ends_at ?? null))
  const [sortOrder, setSortOrder] = useState(String(task?.sort_order ?? 0))

  const params =
    kind === 'promo_video'
      ? { view_ratio: viewRatio, min_views: minViews, hold_days: holdDays }
      : kind === 'invites'
        ? { per_round: perRound }
        : kind === 'brand_first_steps'
          ? { adverts, offers }
          : {}

  const submit = () =>
    startTransition(async () => {
      const result = await saveTask(task?.id ?? null, {
        kind,
        title,
        description,
        rewardType,
        rewardPlan,
        rewardDays,
        rewardPercent,
        maxRounds,
        params,
        targetUserIds: targets,
        isActive,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        sortOrder,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? 'Kaydedildi.')
      onSaved()
      onClose()
    })

  const numberInput = (value: string, set: (v: string) => void, props: Record<string, unknown>, extra: Record<string, unknown> = {}) => (
    <Input {...props} type="number" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} {...extra} />
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isPending}
      size="lg"
      title={task ? 'Görevi düzenle' : 'Yeni görev'}
      description={`Kitle: ${TASK_AUDIENCE_LABELS[TASK_KIND_AUDIENCE[kind]]}. Her ödül admin onayından geçer.`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" loading={isPending} onClick={submit}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Görev türü" hint={task ? 'Sonradan değişmez.' : undefined}>
            {(props) => (
              <Select {...props} value={kind} disabled={!!task} onChange={(e) => setKind(e.target.value as TaskKind)}>
                {TASK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {TASK_KIND_LABELS[k]} ({TASK_AUDIENCE_LABELS[TASK_KIND_AUDIENCE[k]]})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-end pb-2">
            <Switch checked={isActive} onChange={setIsActive} label="Görev açık" />
          </div>
        </div>

        <Field label="Başlık">{(props) => <Input {...props} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Açıklama ve kurallar" hint="Ödüllü paylaşımda #reklam / #işbirliği etiketi zorunluluğunu yazın.">
          {(props) => <Textarea {...props} rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ödül">
            {(props) => (
              <Select {...props} value={rewardType} onChange={(e) => setRewardType(e.target.value as typeof rewardType)}>
                <option value="spotlight_days">Spotlight süresi</option>
                <option value="discount_percent">İndirim kodu</option>
              </Select>
            )}
          </Field>
          {rewardType === 'spotlight_days' ? (
            <>
              <Field label="Paket">
                {(props) => (
                  <Select {...props} value={rewardPlan} onChange={(e) => setRewardPlan(e.target.value as typeof rewardPlan)}>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                  </Select>
                )}
              </Field>
              <Field label="Gün" hint="1–365">
                {(props) => numberInput(rewardDays, setRewardDays, props, { min: 1, max: 365 })}
              </Field>
            </>
          ) : (
            <Field label="İndirim (%)" hint="1–90">
              {(props) => numberInput(rewardPercent, setRewardPercent, props, { min: 1, max: 90 })}
            </Field>
          )}
        </div>

        {kind === 'promo_video' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="İzlenme / takipçi oranı" hint="0,1 = %10">
              {(props) => numberInput(viewRatio, setViewRatio, props, { step: 0.01, min: 0.01, max: 1 })}
            </Field>
            <Field label="En az izlenme">{(props) => numberInput(minViews, setMinViews, props, { min: 0 })}</Field>
            <Field label="Bekleme (gün)" hint="Ölçüm bu kadar gün sonra">
              {(props) => numberInput(holdDays, setHoldDays, props, { min: 1, max: 60 })}
            </Field>
          </div>
        )}
        {kind === 'invites' && (
          <Field label="Tur başına doğrulanmış davet">{(props) => numberInput(perRound, setPerRound, props, { min: 1, max: 100 })}</Field>
        )}
        {kind === 'brand_first_steps' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Açılacak ilan">{(props) => numberInput(adverts, setAdverts, props, { min: 0, max: 50 })}</Field>
            <Field label="Gönderilecek teklif">{(props) => numberInput(offers, setOffers, props, { min: 0, max: 200 })}</Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Tekrar (tur)" hint="Kişi başı">
            {(props) => numberInput(maxRounds, setMaxRounds, props, { min: 1, max: 10 })}
          </Field>
          <Field label="Başlangıç">
            {(props) => <Input {...props} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
          </Field>
          <Field label="Bitiş">
            {(props) => <Input {...props} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}
          </Field>
          <Field label="Sıra">{(props) => numberInput(sortOrder, setSortOrder, props)}</Field>
        </div>

        <Field label="Yalnızca şu kullanıcılar (isteğe bağlı)" hint="Kullanıcı ID'leri, virgülle. Boş = rolün tamamı.">
          {(props) => <Textarea {...props} rows={2} value={targets} onChange={(e) => setTargets(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}
