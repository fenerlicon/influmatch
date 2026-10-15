import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

const STEPS = ['Brief', 'Hedef', 'Öneriler', 'Davet'] as const

/** Kampanya sihirbazı adımları: brief → hedef → önerilen profiller → davet (3.19). current: 0-3. */
export default function WizardSteps({ current }: { current: number }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-[12.5px]" aria-label="Kampanya sihirbazı adımları">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold tabular-nums',
                done ? 'border-gold/40 bg-gold/15 text-gold' : active ? 'border-gold bg-gold text-gold-ink' : 'border-line-strong text-ink-faint',
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
            </span>
            <span className={cn(active ? 'font-medium text-ink' : 'text-ink-muted')}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line-strong" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
