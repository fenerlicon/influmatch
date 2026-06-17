'use client'

import { useEffect, useState, useTransition } from 'react'
import { toggleShowcaseVisibility } from '@/app/dashboard/influencer/actions'

interface SpotlightToggleCardProps {
  initialActive: boolean
  verificationStatus?: 'pending' | 'verified' | 'rejected'
  hasConnectedAccounts?: boolean
}

export default function SpotlightToggleCard({
  initialActive,
  verificationStatus = 'pending',
  hasConnectedAccounts = false
}: SpotlightToggleCardProps) {
  // If user is not verified or has no connected accounts, always show as inactive
  const effectiveActive = (verificationStatus === 'verified' && hasConnectedAccounts) ? initialActive : false
  const [isActive, setIsActive] = useState(effectiveActive)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    // If user is not verified or has no connected accounts, always show as inactive
    setIsActive((verificationStatus === 'verified' && hasConnectedAccounts) ? initialActive : false)
  }, [initialActive, verificationStatus, hasConnectedAccounts])

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timeout)
  }, [toast])

  const handleToggle = () => {
    // Check if user has connected accounts
    if (!hasConnectedAccounts) {
      setToast('Hiçbir hesabını resmi olarak bağlamadığın için vitrin modunu açamazsın!')
      setIsActive(false)
      return
    }

    // Check if user is verified
    if (verificationStatus !== 'verified') {
      setToast('HESABINIZ ONAYLANANA KADAR VİTRİNE ÇIKAMAZSINIZ')
      setIsActive(false)
      return
    }

    // Just toggle vitrin visibility
    const nextValue = !isActive
    setIsActive(nextValue)
    startTransition(async () => {
      try {
        await toggleShowcaseVisibility(nextValue)
        setToast(nextValue ? 'Vitrin modun aktif. Profilin vitrin sayfasında görünüyor.' : 'Vitrin modun kapatıldı.')
      } catch (error) {
        console.error('toggleShowcaseVisibility failed', error)
        setIsActive(!nextValue)
        const errorMessage = error instanceof Error ? error.message : 'Değişiklik uygulanamadı.'
        setToast(errorMessage)
      }
    })
  }

  const isDisabled = verificationStatus !== 'verified' || !hasConnectedAccounts

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Vitrin Modu</p>
            <h3 className="mt-2 text-xl font-semibold">Profilini vitrine taşı</h3>
            <p className="mt-2 text-sm text-gray-300">Profilini markaların keşfet sayfasında öne çıkar.</p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending || isDisabled}
            className={`relative h-10 w-20 rounded-full border transition ${isActive && verificationStatus === 'verified' && hasConnectedAccounts
                ? 'border-soft-gold bg-soft-gold/30'
                : 'border-white/15 bg-white/10'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span
              className={`absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white transition ${isActive && verificationStatus === 'verified' && hasConnectedAccounts ? 'right-2 shadow-glow bg-soft-gold text-background' : 'left-2 bg-white/90'
                }`}
            />
          </button>
        </div>
        <div className="mt-5 flex items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.3em] ${isActive && verificationStatus === 'verified' && hasConnectedAccounts ? 'bg-soft-gold/20 text-soft-gold' : 'bg-white/10 text-gray-300'
              }`}
          >
            {isActive && verificationStatus === 'verified' && hasConnectedAccounts ? 'Aktif' : 'Pasif'}
          </span>
          <span className={!hasConnectedAccounts ? 'text-yellow-500 font-medium animate-pulse' : 'text-gray-400'}>
            {!hasConnectedAccounts
              ? '⚠️ Hiçbir sosyal medya hesabını (Instagram veya TikTok) resmi olarak bağlamadığın için vitrinde çıkmıyorsun. Vitrin modunu aktif edebilmek için lütfen önce bir sosyal medya hesabı bağla.'
              : isActive && verificationStatus === 'verified'
                ? 'Profilin vitrin sayfasında görünüyor.'
                : verificationStatus !== 'verified'
                  ? 'Hesabın onaylanana kadar vitrine çıkamazsın.'
                  : 'Vitrin sayfasında görünmek için aktif et.'}
          </span>
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

