'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateAvailability } from '@/app/dashboard/influencer/settings/actions'
import { AVAILABILITY_NOTE_MAX, availabilityText, istanbulToday, type Availability } from '@/lib/availability-shared'

/**
 * "İş alıyorum / Şu an dolu" (3.19). Doluyken keşifte alt sırada görünürsün ve teklif penceresi markayı uyarır
 * (teklif yine gönderilebilir). Bitiş tarihi geçince durum kendiliğinden "İş alıyorum"a döner.
 */
export default function AvailabilitySettings({ initial }: { initial: Availability }) {
  const [saved, setSaved] = useState(initial)
  const [status, setStatus] = useState(initial.status)
  const [note, setNote] = useState(initial.note ?? '')
  const [until, setUntil] = useState(initial.until ?? '')
  const [pending, startTransition] = useTransition()

  const save = (next: { status: 'open' | 'busy'; note?: string; until?: string }) => {
    startTransition(async () => {
      const result = await updateAvailability({ status: next.status, note: next.note ?? null, until: next.until || null })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setSaved(result.availability)
      toast.success('Müsaitlik kaydedildi.')
    })
  }

  const choose = (next: 'open' | 'busy') => {
    setStatus(next)
    if (next === 'open') save({ status: 'open' })
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
      <h2 className="text-xl font-semibold">Müsaitlik</h2>
      <p className="mt-1 text-sm text-gray-400">
        Markalar keşifte ve profilinde durumunu görür. &quot;Şu an dolu&quot; iken keşifte alt sırada görünürsün; markalar yine teklif gönderebilir.
      </p>
      <p className="mt-2 text-xs text-gray-500">Şu anki durum: {availabilityText(saved)}</p>

      <div className="mt-4 inline-flex rounded-2xl border border-white/10 bg-[#0c0d13] p-1" role="radiogroup" aria-label="Müsaitlik durumu">
        {(['open', 'busy'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={status === value}
            disabled={pending}
            onClick={() => choose(value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              status === value ? (value === 'open' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200') : 'text-gray-400 hover:text-white'
            }`}
          >
            {value === 'open' ? 'İş alıyorum' : 'Şu an dolu'}
          </button>
        ))}
      </div>

      {status === 'busy' && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            save({ status: 'busy', note, until })
          }}
        >
          <label className="block text-sm text-gray-400">
            Not (isteğe bağlı)
            <input
              type="text"
              value={note}
              maxLength={AVAILABILITY_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn. Ay sonuna kadar takvimim dolu"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-soft-gold/60"
            />
          </label>
          <label className="block text-sm text-gray-400">
            Bitiş (isteğe bağlı)
            <input
              type="date"
              value={until}
              min={istanbulToday()}
              onChange={(e) => setUntil(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-soft-gold/60"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:bg-soft-gold/20 disabled:opacity-60"
          >
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </form>
      )}
    </section>
  )
}
