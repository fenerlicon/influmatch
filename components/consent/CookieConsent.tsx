'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Çerez tercihi (yalnızca web). Tercih birinci taraf çerezde 12 ay saklanır.
// Zorunlu olmayan araçlar (şu an yalnızca Vercel Speed Insights) yalnızca "Tümünü kabul et" sonrası yüklenir.
// Not: banner metni sade ve geçicidir; hukuki metin avukat onayından geçmeli (docs/HANDOFF.md).
const CONSENT_COOKIE = 'im_cookie_consent'
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60

type Consent = 'essential' | 'all'

function readConsent(): Consent | null {
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
  const value = match?.split('=')[1]
  return value === 'essential' || value === 'all' ? value : null
}

function writeConsent(value: Consent) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
}

export default function CookieConsent() {
  // undefined: henüz okunmadı (sunucu çıktısıyla uyum için banner ilk çizimde gösterilmez)
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined)

  useEffect(() => {
    setConsent(readConsent())
  }, [])

  const choose = (value: Consent) => {
    writeConsent(value)
    setConsent(value)
  }

  return (
    <>
      {consent === 'all' && <SpeedInsights />}
      {consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Çerez tercihi"
          className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-white/10 bg-[#0B0F19]/95 p-5 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
            <p className="flex-1 text-sm leading-relaxed text-gray-300">
              Sitenin çalışması için zorunlu çerezler kullanılır. İsterseniz site performansını ölçen isteğe bağlı araçlara da
              izin verebilirsiniz.{' '}
              <Link href="/legal?tab=cookies" className="text-soft-gold underline underline-offset-2 hover:text-white">
                Çerez Politikası
              </Link>
            </p>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => choose('essential')}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/5"
              >
                Yalnızca zorunlu
              </button>
              <button
                type="button"
                onClick={() => choose('all')}
                className="rounded-xl bg-soft-gold px-4 py-2 text-sm font-semibold text-[#0B0F19] transition hover:bg-[#e0bd4a]"
              >
                Tümünü kabul et
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
