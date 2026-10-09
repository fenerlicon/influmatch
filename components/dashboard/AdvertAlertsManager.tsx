'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { BellRing, Trash2 } from 'lucide-react'
import { createAdvertAlert, deleteAdvertAlert } from '@/app/dashboard/influencer/advert/actions'
import { ADVERT_ALERT_LIMIT, ADVERT_ALERT_PLATFORMS, describeAlert } from '@/lib/advert-alerts-shared'
import type { AdvertAlert } from '@/lib/advert-alerts'

interface AdvertAlertsManagerProps {
  initialAlerts: AdvertAlert[]
}

const emptyForm = { category: '', platform: '', minBudget: '' }

/** Influencer ilan alarmları: yeni açılan ilan alarma uyarsa bildirim (+ e-posta tercihine göre) gelir. */
export default function AdvertAlertsManager({ initialAlerts }: AdvertAlertsManagerProps) {
  const [alerts, setAlerts] = useState<AdvertAlert[]>(initialAlerts)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const atLimit = alerts.length >= ADVERT_ALERT_LIMIT

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await createAdvertAlert({ category: form.category, platform: form.platform, minBudget: form.minBudget })
      if ('error' in result && result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      if ('alert' in result && result.alert) {
        const created = result.alert
        setAlerts((prev) => [...prev, created])
      }
      setForm(emptyForm)
      setMessage({ type: 'success', text: 'Alarm kuruldu. Uygun yeni ilan çıkınca bildirim alacaksın.' })
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteAdvertAlert(id)
      if ('error' in result && result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setAlerts((prev) => prev.filter((a) => a.id !== id))
      setMessage(null)
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
        <div className="flex items-center gap-2 text-white">
          <BellRing className="h-5 w-5 text-soft-gold" />
          <span className="font-semibold">İlan alarmları</span>
          <span className="text-xs text-gray-500">
            ({alerts.length}/{ADVERT_ALERT_LIMIT})
          </span>
        </div>
        <p className="mt-2 text-gray-400">
          Kategori/anahtar kelime, platform ve en az bütçe seç. Bu koşullara uyan yeni bir ilan yayınlanınca site içinde ve
          mobilde bildirim alırsın; e-posta, ayarlardaki &quot;İlan Başvuruları&quot; tercihine göre gider. Boş bıraktığın alan
          &quot;fark etmez&quot; demektir.
        </p>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 rounded-3xl border border-white/10 bg-[#0E0F15] p-5 sm:grid-cols-4">
        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          maxLength={60}
          placeholder="Kategori / kelime (ör. kozmetik)"
          aria-label="Kategori veya anahtar kelime"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-soft-gold/60"
        />
        <select
          value={form.platform}
          onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
          aria-label="Platform"
          className="rounded-2xl border border-white/10 bg-[#0E0F15] px-4 py-2 text-sm text-white outline-none focus:border-soft-gold/60"
        >
          <option value="">Platform fark etmez</option>
          {ADVERT_ALERT_PLATFORMS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          step={100}
          value={form.minBudget}
          onChange={(e) => setForm((prev) => ({ ...prev, minBudget: e.target.value }))}
          placeholder="En az bütçe (₺)"
          aria-label="En az bütçe"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-soft-gold/60"
        />
        <button
          type="submit"
          disabled={isPending || atLimit}
          className="rounded-2xl border border-soft-gold/60 bg-soft-gold/15 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:bg-soft-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {atLimit ? `En fazla ${ADVERT_ALERT_LIMIT} alarm` : isPending ? 'Kaydediliyor...' : 'Alarm kur'}
        </button>
      </form>

      {message ? (
        <p className={`text-sm ${message.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>
      ) : null}

      {alerts.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-gray-400">Henüz alarm kurmadın.</div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0E0F15] px-4 py-3">
              <span className="text-sm text-white">{describeAlert(alert)}</span>
              <button
                type="button"
                onClick={() => handleDelete(alert.id)}
                disabled={isPending}
                aria-label="Alarmı sil"
                className="rounded-full border border-white/10 p-2 text-gray-400 transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
