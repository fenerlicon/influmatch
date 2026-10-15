'use client'

import { useState, useTransition } from 'react'
import { Bookmark, CheckCircle2, Send } from 'lucide-react'
import { applyToAdvert } from '@/app/dashboard/influencer/advert/actions'
import { Avatar, Button, Chip, Eyebrow, Field, Input, Notice, Segmented, Textarea, VerifiedTick } from '@/components/ui'
import {
  ANSWER_MAX_LENGTH,
  PAYMENT_LABELS,
  formatAdvertBudget,
  formatDay,
  isPastDeadline,
  isQuestionRequired,
  type AdvertAnswerInput,
  type AdvertProject,
  type AdvertQuestion,
} from '@/lib/adverts-shared'
import { advertCategoryLabel } from '@/utils/categories'
import { cn } from '@/utils/cn'

interface Props {
  project: AdvertProject
  /** Influencer: başvuru formu ve kaydet düğmesi. Marka: yalnızca okunur. */
  mode: 'influencer' | 'brand'
  applied?: boolean
  saved?: boolean
  onToggleSave?: () => void
  onApplied?: () => void
  /** Marka kendi ilanını görüyorsa. */
  isOwn?: boolean
}

const emptyForm = { coverLetter: '', deliverableIdea: '', budget: '', payment: 'cash' as 'cash' | 'barter' }

const optionsOf = (q: AdvertQuestion) => (q.options ?? []).filter((o) => o?.trim())

/** Tek bir sorunun yanıt alanı (metin / tek seçim / çoklu seçim). Kurallar sunucuda (lib/adverts.ts validateAnswers). */
function QuestionInput({ q, index, value, onChange }: { q: AdvertQuestion; index: number; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const required = isQuestionRequired(q)
  const label = `${index + 1}. ${q.question}${required ? '' : ' (isteğe bağlı)'}`
  if (q.type === 'text') {
    return (
      <Field label={label}>
        {(p) => <Textarea {...p} rows={2} maxLength={ANSWER_MAX_LENGTH} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />}
      </Field>
    )
  }
  const multiple = q.type === 'multiple_choice'
  const selected = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-[12.5px] font-medium text-ink-muted">
        {label}
        {multiple && <span className="text-ink-faint"> · birden fazla seçebilirsin</span>}
      </legend>
      {optionsOf(q).map((option) => {
        const on = selected.includes(option)
        return (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink">
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={`question-${q.id}`}
              checked={on}
              onChange={() => onChange(multiple ? (on ? selected.filter((o) => o !== option) : [...selected, option]) : option)}
              className="h-4 w-4 accent-gold"
            />
            {option}
          </label>
        )
      })}
    </fieldset>
  )
}

/** İlan ayrıntısı (sağ panel / telefonda pencere) ve influencer başvuru formu. */
export default function AdvertDetail({ project, mode, applied, saved, onToggleSave, onApplied, isOwn }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [answers, setAnswers] = useState<AdvertAnswerInput>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const closed = project.status !== 'open' || isPastDeadline(project.deadline)
  const questions = (project.customQuestions ?? []).filter((q) => q.question?.trim())
  const deadline = formatDay(project.deadline)

  const submit = () => {
    if (!form.coverLetter.trim()) {
      setError('Kısa bir niyet mesajı yazmalısın.')
      return
    }
    const missing = questions.findIndex((q) => {
      if (!isQuestionRequired(q)) return false
      const v = answers[q.id]
      return Array.isArray(v) ? v.length === 0 : !v?.trim()
    })
    if (missing >= 0) {
      setError(`${missing + 1}. soruyu yanıtlamalısın.`)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await applyToAdvert({
        advertId: project.id,
        coverLetter: form.coverLetter,
        deliverableIdea: form.deliverableIdea,
        budgetExpectation: form.payment === 'barter' ? 0 : form.budget ? Number.parseFloat(form.budget.replace(/\./g, '').replace(',', '.')) : null,
        answers,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      setForm(emptyForm)
      setAnswers({})
      onApplied?.()
    })
  }

  const facts: Array<[string, string]> = [
    ['Bütçe', formatAdvertBudget(project)],
    ['Ödeme', PAYMENT_LABELS[project.paymentType ?? 'cash']],
    ...(project.deliverables.length ? ([['Teslimat', project.deliverables.join(', ')]] as Array<[string, string]>) : []),
    ...(project.platforms.length ? ([['Platform', project.platforms.join(', ')]] as Array<[string, string]>) : []),
    ['Konum', project.location || 'Uzaktan'],
    ...(deadline ? ([['Son başvuru', deadline]] as Array<[string, string]>) : []),
  ]

  return (
    <div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={project.brandName} src={project.brandAvatar} square />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <span className="truncate">{project.brandName}</span>
                {project.brandVerificationStatus === 'verified' && <VerifiedTick tone="gold" />}
              </div>
              <div className="text-xs text-ink-faint">{advertCategoryLabel(project.category)}</div>
            </div>
          </div>
          {mode === 'influencer' && onToggleSave && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onToggleSave}
              aria-pressed={saved}
              aria-label={saved ? 'Kaydedilenlerden çıkar' : 'İlanı kaydet'}
              title={saved ? 'Kaydedilenlerden çıkar' : 'İlanı kaydet'}
              className={cn(saved && 'text-gold hover:text-gold')}
            >
              <Bookmark className={cn(saved && 'fill-current')} />
            </Button>
          )}
          {isOwn && <Chip tone="gold">Senin ilanın</Chip>}
        </div>
        <h2 className="mt-3.5 text-[19px] font-semibold tracking-tight text-ink">{project.title}</h2>
        {project.summary && <p className="mt-2 whitespace-pre-line text-[13.5px] text-ink-muted">{project.summary}</p>}
      </div>

      <div className="border-t border-line px-5 py-4">
        <dl className="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {questions.length > 0 && (mode !== 'influencer' || applied || closed) && (
        <div className="border-t border-line px-5 py-4">
          <Eyebrow>Markanın soruları</Eyebrow>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-[18px] text-[13.5px] text-ink-muted">
            {questions.map((q) => (
              <li key={q.id}>
                {q.question}
                {q.options && q.options.filter(Boolean).length > 0 && <span className="text-ink-faint"> ({q.options.filter(Boolean).join(' / ')})</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {mode === 'influencer' && (
        <div className="border-t border-line px-5 py-4">
          {applied ? (
            <Notice tone="success" icon={CheckCircle2} title="Başvurdun.">
              Marka inceleyince bildirim alırsın; durumu Başvurularım sekmesinde.
            </Notice>
          ) : closed ? (
            <Notice tone="info">Bu ilan artık başvuru almıyor.</Notice>
          ) : (
            <div className="grid gap-3">
              {questions.length > 0 && (
                <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3">
                  <Eyebrow>Markanın soruları</Eyebrow>
                  {questions.map((q, i) => (
                    <QuestionInput key={q.id} q={q} index={i} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                  ))}
                </div>
              )}
              <Field label="Niyet mesajın" error={error ?? undefined}>
                {(p) => (
                  <Textarea
                    {...p}
                    value={form.coverLetter}
                    maxLength={3000}
                    onChange={(e) => setForm((f) => ({ ...f, coverLetter: e.target.value }))}
                    placeholder="Neden bu iş için uygunsun? Kısaca yaz."
                  />
                )}
              </Field>
              <Field label="Önerdiğin teslimat" hint="İsteğe bağlı">
                {(p) => <Input {...p} value={form.deliverableIdea} onChange={(e) => setForm((f) => ({ ...f, deliverableIdea: e.target.value }))} placeholder="Örn. 1 Reels + 3 Story" />}
              </Field>
              <div className="grid gap-1.5">
                <span className="text-[12.5px] font-medium text-ink-muted">Ücret beklentin</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    label="Ödeme türü"
                    value={form.payment}
                    onSelect={(v) => setForm((f) => ({ ...f, payment: v as 'cash' | 'barter', budget: v === 'barter' ? '' : f.budget }))}
                    items={[
                      { value: 'cash', label: 'Nakit' },
                      { value: 'barter', label: 'Barter' },
                    ]}
                  />
                  {form.payment === 'cash' && (
                    <Input
                      aria-label="Bütçe beklentin (₺)"
                      inputMode="numeric"
                      value={form.budget}
                      onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                      placeholder="₺ tutar (isteğe bağlı)"
                      className="w-auto min-w-0 flex-1"
                    />
                  )}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Button variant="primary" leftIcon={<Send />} loading={isPending} onClick={submit}>
                  Başvur
                </Button>
                <span className="text-xs text-ink-faint">Marka profilini ve doğrulanmış hesaplarını görür.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
