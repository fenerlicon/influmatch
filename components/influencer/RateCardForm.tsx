'use client'

import { useState, useTransition } from 'react'
import { saveRateCard } from '@/app/dashboard/influencer/profile/actions'
import { RATE_CARD_ITEMS, type RateCard, type RateCardKey } from '@/lib/rate-card-shared'

interface Props {
  initial: RateCard | null
}

export default function RateCardForm({ initial }: Props) {
  const [prices, setPrices] = useState<Record<RateCardKey, string>>(() => {
    const result = {} as Record<RateCardKey, string>
    for (const item of RATE_CARD_ITEMS) result[item.key] = initial?.prices[item.key] ? String(initial.prices[item.key]) : ''
    return result
  })
  const [negotiable, setNegotiable] = useState(initial?.negotiable ?? false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await saveRateCard({ prices, negotiable })
      if (!result.success) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setMessage({ type: 'success', text: result.rateCard ? 'Fiyat kartınız kaydedildi.' : 'Fiyat kartınız kaldırıldı.' })
    })
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-[#0F1014] p-6 text-white shadow-glow">
      <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Fiyat Kartı</p>
      <h2 className="mt-2 text-lg font-semibold">Başlangıç fiyatlarınız</h2>
      <p className="mt-1 text-sm text-gray-400">
        Her teslimat türü için başlangıç fiyatınızı (₺) girin; vermediğiniz türleri boş bırakın. Fiyat kartınızı yalnızca
        doğrulanmış markalar görür, diğer influencer&apos;lar göremez. Markalar keşifte bütçeye göre filtreleyebilir.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {RATE_CARD_ITEMS.map((item) => (
          <label key={item.key} className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-gray-400">{item.label}</span>
            <div className="flex items-center rounded-xl border border-white/10 bg-white/5 focus-within:border-soft-gold/50">
              <span className="pl-3 text-sm text-gray-400">₺</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                placeholder="Boş"
                value={prices[item.key]}
                onChange={(e) => setPrices((p) => ({ ...p, [item.key]: e.target.value.replace(/[^\d.]/g, '') }))}
                className="w-full bg-transparent px-2 py-2.5 text-sm text-white outline-none"
              />
            </div>
          </label>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm text-gray-300">
        <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} className="h-4 w-4 accent-[#D4AF37]" />
        Pazarlığa açığım
      </label>

      {message && (
        <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{message.text}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 rounded-xl bg-soft-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-soft-gold/90 disabled:opacity-50"
      >
        {isPending ? 'Kaydediliyor…' : 'Fiyat kartını kaydet'}
      </button>
    </form>
  )
}
