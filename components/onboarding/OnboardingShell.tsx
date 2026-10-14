import Link from 'next/link'
import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/ui'
import { cn } from '@/utils/cn'

/**
 * Kayıt sonrası adımların kabuğu (profil → hesap doğrulama). steps verilirse üstte adım çubuğu görünür;
 * current 0'dan başlar. Marka tek adım olduğu için çubuk göstermez.
 */
export default function OnboardingShell({
  eyebrow,
  title,
  description,
  steps,
  current = 0,
  aside,
  children,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  steps?: string[]
  current?: number
  /** Üst çubuğun sağı (ör. çıkış). */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex h-[60px] max-w-[760px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-[15px] font-bold tracking-[0.02em] text-ink" aria-label="Influmatch ana sayfa">
            INFLU<span className="text-gold">MATCH</span>
          </Link>
          {aside}
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 md:py-12">
        {steps && steps.length > 1 && (
          <ol className="mb-8 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Adımlar">
            {steps.map((step, i) => (
              <li key={step} aria-current={i === current ? 'step' : undefined} className="grid gap-2">
                <span className={cn('h-1 rounded-full', i < current ? 'bg-success' : i === current ? 'bg-gold' : 'bg-surface-3')} />
                <span className={cn('text-xs', i === current ? 'font-medium text-ink' : 'text-ink-faint')}>
                  {i + 1}. {step}
                </span>
              </li>
            ))}
          </ol>
        )}
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 font-display text-[34px] font-normal leading-[1.1] md:text-[40px]">{title}</h1>
        {description && <div className="mt-2 max-w-[600px] text-[14px] text-ink-muted">{description}</div>}
        <div className="mt-7">{children}</div>
      </main>
    </div>
  )
}
