'use client'

import { useEffect, useState, useTransition } from 'react'
import { toggleSpotlight } from '@/app/dashboard/influencer/actions'

interface SpotlightToggleCardProps {
  initialActive: boolean
}

export default function SpotlightToggleCard({ initialActive }: SpotlightToggleCardProps) {
  const [isActive, setIsActive] = useState(initialActive)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    setIsActive(initialActive)
  }, [initialActive])

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timeout)
  }, [toast])

  const handleToggle = () => {
    const nextValue = !isActive
    setIsActive(nextValue)
    startTransition(async () => {
      try {
        await toggleSpotlight(nextValue)
        setToast(nextValue ? 'Spotlight modun aktif.' : 'Spotlight modun kapatıldı.')
      } catch (error) {
        console.error('toggleSpotlight failed', error)
        setIsActive(!nextValue)
        setToast('Değişiklik uygulanamadı.')
      }
    })
  }

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Spotlight Modu</p>
            <h3 className="mt-2 text-xl font-semibold">Profilini vitrine taşı</h3>
            <p className="mt-2 text-sm text-gray-300">Profilini markaların keşfet sayfasında öne çıkar.</p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`relative h-10 w-20 rounded-full border transition ${
              isActive
                ? 'border-soft-gold bg-soft-gold/30'
                : 'border-white/15 bg-white/10'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span
              className={`absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white transition ${
                isActive ? 'right-2 shadow-glow bg-soft-gold text-background' : 'left-2 bg-white/90'
              }`}
            />
          </button>
        </div>
        <div className="mt-5 flex items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.3em] ${
              isActive ? 'bg-soft-gold/20 text-soft-gold' : 'bg-white/10 text-gray-300'
            }`}
          >
            {isActive ? 'Aktif' : 'Pasif'}
          </span>
          <span className="text-gray-400">{isActive ? 'Markalar seni görmeye hazır.' : 'İstersen dilediğin zaman açabilirsin.'}</span>
        </div>
      </div>

      {toast ? (
        <div className="fixed right-6 bottom-6 z-40 rounded-2xl border border-white/10 bg-[#0F1014]/90 px-4 py-2 text-sm text-white shadow-glow">
          {toast}
        </div>
      ) : null}
    </>
  )
}

