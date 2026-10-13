'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Check, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { toggleShowcaseVisibility } from '@/app/dashboard/influencer/actions'
import { Button, ButtonLink, Card, Chip, Eyebrow, Modal, Switch, VerifiedTick } from '@/components/ui'
import { cn } from '@/utils/cn'
import { firstStepsLabel } from '@/lib/first-steps-shared'

// Hesap durumu: eski "Profil doluluk", "İlk adımlar", "Güven skoru", "Mavi tik" ve vitrin anahtarı tek kartta
// (docs/REDESIGN.md). Adımlar lib/first-steps.ts'ten gelir; isteğe bağlı adımlar yüzdeye katılmaz.

export interface StatusStep {
  key: string
  title: string
  description: string
  done: boolean
  note?: string | null
  href: string
  optional?: boolean
}

interface Props {
  steps: StatusStep[]
  /** Hepsi tamamken başlık (ör. "Onaylı marka"). */
  doneTitle: string
  /** Başlığın yanındaki çip (ör. onay durumu). */
  badge?: { tone: 'success' | 'info' | 'warning'; label: string }
  trustScore?: number | null
  blueTick?: { has: boolean; criteria: Array<{ key: string; label: string; detail: string; met: boolean }> } | null
  showcase?: { visible: boolean; disabledReason: string | null } | null
}

function Ring({ percent }: { percent: number }) {
  return (
    <div
      className="grid h-[72px] w-[72px] flex-none place-items-center rounded-full"
      style={{ background: `conic-gradient(#D4AF37 ${percent * 3.6}deg, #1F2129 0)` }}
      aria-label={`Yüzde ${percent} tamam`}
      role="img"
    >
      <span className="grid h-[58px] w-[58px] place-items-center rounded-full bg-surface-1 text-base font-semibold tabular-nums text-ink">%{percent}</span>
    </div>
  )
}

export default function AccountStatusCard({ steps, doneTitle, badge, trustScore, blueTick, showcase }: Props) {
  const [blueTickOpen, setBlueTickOpen] = useState(false)
  const [visible, setVisible] = useState(showcase?.visible ?? false)
  const [pending, start] = useTransition()

  const required = steps.filter((s) => !s.optional)
  const doneCount = required.filter((s) => s.done).length
  const percent = required.length ? Math.round((doneCount / required.length) * 100) : 100
  const next = required.find((s) => !s.done) ?? steps.find((s) => !s.done) ?? null
  const allDone = doneCount === required.length

  const toggleShowcase = (value: boolean) => {
    setVisible(value)
    start(async () => {
      try {
        await toggleShowcaseVisibility(value)
        toast.success(value ? 'Profilin vitrinde görünüyor.' : 'Profilin vitrinden gizlendi.')
      } catch (error) {
        setVisible(!value)
        toast.error(error instanceof Error ? error.message : 'Değişiklik uygulanamadı.')
      }
    })
  }

  const metCount = blueTick?.criteria.filter((c) => c.met).length ?? 0

  return (
    <Card as="section" padded>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Hesap durumu</Eyebrow>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-ink">
            {allDone ? doneTitle : firstStepsLabel(doneCount, required.length)}
          </h2>
          {badge && (
            <Chip tone={badge.tone} className="mt-2">
              {badge.label}
            </Chip>
          )}
        </div>
        <Ring percent={percent} />
      </div>

      {next && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3.5">
          <div className="text-xs text-ink-faint">Sıradaki adım{next.optional ? ' (isteğe bağlı)' : ''}</div>
          <div className="mt-0.5 font-medium text-ink">{next.title}</div>
          <p className="mb-3 mt-1 text-[12.5px] text-ink-muted">{next.description}</p>
          <ButtonLink href={next.href} size="sm" rightIcon={<ArrowRight />}>
            Şimdi yap
          </ButtonLink>
        </div>
      )}

      <ul className="mt-3 grid">
        {steps.map((s) => (
          <li key={s.key} className={cn('flex items-center gap-2.5 py-1.5 text-[13px]', s.done ? 'text-ink-faint' : s === next ? 'font-medium text-ink' : 'text-ink-muted')}>
            <span
              className={cn(
                'grid h-[18px] w-[18px] flex-none place-items-center rounded-full border',
                s.done ? 'border-transparent bg-success/10 text-success' : s === next ? 'border-gold' : 'border-line-strong',
              )}
            >
              {s.done && <Check className="h-[11px] w-[11px]" strokeWidth={3} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1 truncate">{s.title}</span>
            {s.note && <Chip tone="warning">{s.note}</Chip>}
            {s.optional && !s.done && <Chip>İsteğe bağlı</Chip>}
          </li>
        ))}
      </ul>

      {typeof trustScore === 'number' && (
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5 text-[13px]">
          <span className="text-ink-muted">Güven skoru</span>
          <span className="font-semibold tabular-nums text-ink">
            {trustScore} <span className="font-normal text-ink-faint">/ 100</span>
          </span>
        </div>
      )}

      {blueTick && (
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5 text-[13px]">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <VerifiedTick /> Mavi tik
          </span>
          <button type="button" onClick={() => setBlueTickOpen(true)} className="text-[12.5px] text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            {blueTick.has ? 'Aktif' : firstStepsLabel(metCount, blueTick.criteria.length).replace('adımdan', 'koşuldan')}
          </button>
        </div>
      )}

      {showcase && (
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[13px]">
          <div className="min-w-0">
            <div className="text-ink-muted">Vitrinde görün</div>
            {showcase.disabledReason && <div className="text-xs text-ink-faint">{showcase.disabledReason}</div>}
          </div>
          <Switch checked={visible} onChange={toggleShowcase} disabled={pending || !!showcase.disabledReason} label="Vitrinde görün" />
        </div>
      )}

      {blueTick && (
        <Modal
          open={blueTickOpen}
          onClose={() => setBlueTickOpen(false)}
          title="Mavi tik koşulları"
          description={blueTick.has ? 'Mavi tikin aktif.' : 'Koşulların hepsi sağlandığında mavi tik otomatik verilir.'}
          footer={
            <Button size="sm" onClick={() => setBlueTickOpen(false)}>
              Kapat
            </Button>
          }
        >
          <ul className="grid gap-3">
            {blueTick.criteria.map((c) => (
              <li key={c.key} className="flex items-start gap-2.5 text-[13.5px]">
                {c.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" /> : <Circle className="mt-0.5 h-4 w-4 flex-none text-ink-faint" />}
                <div>
                  <div className={c.met ? 'text-ink' : 'text-ink-muted'}>{c.label}</div>
                  <div className="text-xs text-ink-faint">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-faint">Koşullar her saat kontrol edilir; biri bozulursa mavi tik kalkar.</p>
        </Modal>
      )}
    </Card>
  )
}
