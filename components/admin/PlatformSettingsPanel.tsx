'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { updatePlatformSettings } from '@/app/admin/limits/actions'
import type { PlatformSettings } from '@/lib/platform-settings-shared'

type LimitKey =
  | 'free_offers_per_day'
  | 'free_offers_per_month'
  | 'free_active_adverts'
  | 'basic_offers_per_day'
  | 'basic_offers_per_month'
  | 'basic_active_adverts'

const LIMIT_ROWS: { label: string; free: LimitKey; basic: LimitKey }[] = [
  { label: 'Günlük teklif', free: 'free_offers_per_day', basic: 'basic_offers_per_day' },
  { label: 'Aylık teklif (takvim ayı, Türkiye saati)', free: 'free_offers_per_month', basic: 'basic_offers_per_month' },
  { label: 'Aynı anda aktif ilan', free: 'free_active_adverts', basic: 'basic_active_adverts' },
]

type FormState = Record<keyof PlatformSettings, string | boolean>

function toForm(settings: PlatformSettings): FormState {
  const out = {} as FormState
  for (const [key, value] of Object.entries(settings) as [keyof PlatformSettings, unknown][]) {
    out[key] = typeof value === 'boolean' ? value : value === null ? '' : String(value)
  }
  return out
}

const inputClass =
  'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-soft-gold/60'

/** Ücretsiz marka sınırları + keşif çarkı ayarları (admin). Boş alan = sınırsız. */
export default function PlatformSettingsPanel({ initialSettings }: { initialSettings: PlatformSettings }) {
  const [form, setForm] = useState<FormState>(() => toForm(initialSettings))
  const [saved, setSaved] = useState<PlatformSettings>(initialSettings)
  const [isPending, startTransition] = useTransition()

  const setField = (key: keyof PlatformSettings, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (form.free_brand_limits_enabled !== saved.free_brand_limits_enabled) {
      const message = form.free_brand_limits_enabled
        ? 'Ücretsiz marka sınırları ve keşif çarkı AÇILACAK. Spotlight olmayan markalar tüm profilleri göremeyecek ve teklif/ilan sınırları başlayacak. Devam edilsin mi?'
        : 'Ücretsiz marka sınırları KAPATILACAK; bütün markalar yeniden tüm profilleri görecek. Devam edilsin mi?'
      if (!window.confirm(message)) return
    }
    startTransition(async () => {
      const result = await updatePlatformSettings(form as Record<string, unknown>)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSaved(result.settings)
      setForm(toForm(result.settings))
      toast.success('Ayarlar kaydedildi.')
    })
  }

  return (
    <main className="min-h-screen bg-[#0B0C10] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Admin paneli
        </Link>

        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Platform ayarları</p>
          <h1 className="mt-2 text-2xl font-semibold">Ücretsiz marka sınırları ve keşif çarkı</h1>
          <p className="mt-2 text-sm text-gray-400">
            Karar (2026-10-10): satış başlayana kadar kapalı kalır. Kapalıyken hiçbir sınır uygulanmaz, keşif bugünkü gibidir.
            Açıkken Spotlight olmayan markalar keşifte yalnızca çarktaki profilleri görür; Basic sınırları aşağıdaki değerlerle
            (boş = sınırsız), Pro her zaman sınırsızdır. Influencer/UGC hesapları sınırlanmaz.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-semibold">Sınırlar ve keşif çarkı</span>
                <span className="block text-sm text-gray-400">
                  Şu an: {saved.free_brand_limits_enabled ? 'AÇIK' : 'KAPALI'}
                </span>
              </span>
              <input
                type="checkbox"
                className="h-6 w-6 accent-[#D4AF37]"
                checked={form.free_brand_limits_enabled === true}
                onChange={(event) => setField('free_brand_limits_enabled', event.target.checked)}
              />
            </label>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold">Keşif çarkı (ücretsiz marka)</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-gray-400">
                Çevirme başına profil (1-50)
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  className={inputClass}
                  value={String(form.wheel_profiles_per_day)}
                  onChange={(event) => setField('wheel_profiles_per_day', event.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-400">
                Profillerin açık kaldığı süre / çevirme aralığı (saat, 1-168)
                <input
                  type="number"
                  min={1}
                  max={168}
                  required
                  className={inputClass}
                  value={String(form.wheel_window_hours)}
                  onChange={(event) => setField('wheel_window_hours', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold">Teklif ve ilan sınırları</h2>
            <p className="mt-1 text-sm text-gray-400">Boş bırakılan alan sınırsızdır. 0 = hiç izin yok.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-2 font-medium">Sınır</th>
                    <th className="pb-2 font-medium">Ücretsiz marka</th>
                    <th className="pb-2 font-medium">Spotlight Basic</th>
                    <th className="pb-2 font-medium">Spotlight Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {LIMIT_ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-white/5">
                      <td className="py-3 pr-3 text-gray-200">{row.label}</td>
                      {[row.free, row.basic].map((key) => (
                        <td key={key} className="py-3 pr-3">
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            placeholder="Sınırsız"
                            className={inputClass}
                            value={String(form[key])}
                            onChange={(event) => setField(key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="py-3 text-gray-400">Sınırsız</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-5 py-2.5 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Kaydet
          </button>
        </form>
      </div>
    </main>
  )
}
