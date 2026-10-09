'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { FIRST_STEPS_HIDDEN_COOKIE, type FirstStepsStatus } from '@/lib/first-steps-shared'

interface FirstStepsCardProps {
  userId: string
  status: FirstStepsStatus
}

/** Yeni kullanıcılar için "İlk adımlar" kartı. Tüm adımlar bitince sayfa kartı hiç göstermez. */
export default function FirstStepsCard({ userId, status }: FirstStepsCardProps) {
  const [hidden, setHidden] = useState(false)
  if (hidden || status.allDone) return null

  const percent = Math.round((status.completed / status.total) * 100)

  const hide = () => {
    // Kritik olmayan arayüz tercihi: yalnızca bu tarayıcıda, 1 yıl.
    document.cookie = `${FIRST_STEPS_HIDDEN_COOKIE}=${userId}; path=/; max-age=31536000; samesite=lax`
    setHidden(true)
  }

  return (
    <section className="rounded-3xl border border-soft-gold/30 bg-white/5 p-6 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">İlk adımlar</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{status.label}</h2>
        </div>
        <button
          type="button"
          onClick={hide}
          className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
        >
          Gizle
        </button>
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={status.total}
        aria-valuenow={status.completed}
      >
        <div className="h-full rounded-full bg-soft-gold transition-all" style={{ width: `${percent}%` }} />
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {status.steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`flex h-full items-start gap-3 rounded-2xl border p-4 transition ${
                step.done
                  ? 'border-green-500/20 bg-green-500/5'
                  : 'border-white/10 bg-[#11121A] hover:border-soft-gold/40'
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-semibold ${step.done ? 'text-gray-400 line-through' : 'text-white'}`}>{step.title}</p>
                  {step.note && (
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
                      {step.note}
                    </span>
                  )}
                </div>
                {!step.done && <p className="mt-1 text-xs text-gray-400">{step.description}</p>}
              </div>
              {!step.done && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
