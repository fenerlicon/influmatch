import Link from 'next/link'
import { BadgeCheck, CheckCircle2, Circle } from 'lucide-react'
import type { BlueTickEvaluation } from '@/lib/blue-tick-rules'

interface BlueTickProgressCardProps {
  evaluation: BlueTickEvaluation
  hasBlueTick: boolean
}

export default function BlueTickProgressCard({ evaluation, hasBlueTick }: BlueTickProgressCardProps) {
  const metCount = evaluation.criteria.filter((criterion) => criterion.met).length
  const spotlightMissing = !evaluation.criteria.find((criterion) => criterion.key === 'spotlight')?.met

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <BadgeCheck className="h-5 w-5 text-blue-400" /> Mavi Tik
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {hasBlueTick
              ? 'Mavi tikin aktif: Influmatch’in seçkin içerik üreticileri arasındasın.'
              : 'Mavi tik, Influmatch’in en seçkin içerik üreticilerine otomatik verilir.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
          {metCount}/{evaluation.criteria.length}
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {evaluation.criteria.map((criterion) => (
          <li key={criterion.key} className="flex items-start gap-3 text-sm">
            {criterion.met ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            )}
            <div>
              <p className={criterion.met ? 'text-white' : 'text-gray-300'}>{criterion.label}</p>
              <p className="text-xs text-gray-500">{criterion.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {spotlightMissing && (
        <Link
          href="/dashboard/spotlight"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
        >
          Spotlight&apos;a Geç
        </Link>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Koşullar her saat otomatik kontrol edilir; koşullardan biri bozulursa mavi tik kalkar.
      </p>
    </div>
  )
}
