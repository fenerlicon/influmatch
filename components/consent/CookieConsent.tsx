'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from '@supabase/auth-helpers-react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { buttonClasses } from '@/components/ui'
import { COOKIE_POLICY_VERSION, COOKIE_PREFERENCES_EVENT, decodeCookieChoice, encodeCookieChoice, type CookieChoice } from '@/lib/consent-shared'

// Çerez tercihi (yalnızca web). Tercih birinci taraf çerezde 12 ay saklanır (değer: "all.<sürüm>" / "essential.<sürüm>").
// Zorunlu olmayan araçlar (şu an yalnızca Vercel Speed Insights) yalnızca "Tümünü kabul et" sonrası yüklenir.
// KVKK Çerez Rehberi mekaniği: reddetmek kabul etmek kadar kolay (iki düğme eşit görünümde), tercih sonradan
// alt bilgideki / ayarlardaki "Çerez tercihleri" bağlantısıyla değiştirilebilir (COOKIE_PREFERENCES_EVENT),
// politika sürümü değişince yeniden sorulur, giriş yapmış kullanıcının tercihi /api/consent ile kayda geçer.
// Not: banner metni sade ve geçicidir; hukuki metin avukat onayından geçmeli (docs/KVKK.md).
const CONSENT_COOKIE = 'im_cookie_consent'
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60
// Hangi kullanıcı + tercih + sürüm sunucuya bildirildi (aynı kaydı her sayfada tekrar göndermemek için).
const SYNC_KEY = 'im_cookie_consent_synced'

function readConsent(): CookieChoice | null {
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
  return decodeCookieChoice(match ? decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1)) : null)
}

function writeConsent(value: CookieChoice) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${encodeCookieChoice(value)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
}

function readSynced(): string | null {
  try {
    return window.localStorage.getItem(SYNC_KEY)
  } catch {
    return null
  }
}

function writeSynced(value: string) {
  try {
    window.localStorage.setItem(SYNC_KEY, value)
  } catch {
    // depolama kapalıysa bir sonraki sayfada yeniden bildirilir (sunucu aynı kaydı tekrar yazmaz)
  }
}

export default function CookieConsent() {
  // undefined: henüz okunmadı (sunucu çıktısıyla uyum için banner ilk çizimde gösterilmez)
  const [consent, setConsent] = useState<CookieChoice | null | undefined>(undefined)
  const [reopened, setReopened] = useState(false)
  const session = useSession()
  const userId = session?.user?.id ?? null

  useEffect(() => {
    setConsent(readConsent())
    const reopen = () => setReopened(true)
    window.addEventListener(COOKIE_PREFERENCES_EVENT, reopen)
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, reopen)
  }, [])

  // Giriş yapmış kullanıcının tercihi kayda geçer (tercih girişten önce verilmiş olsa da).
  useEffect(() => {
    if (!userId || !consent) return
    const marker = `${userId}:${consent}:${COOKIE_POLICY_VERSION}`
    if (readSynced() === marker) return
    fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'cookies_optional', granted: consent === 'all' }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result?.recorded) writeSynced(marker)
      })
      .catch(() => null)
  }, [userId, consent])

  const choose = (value: CookieChoice) => {
    const downgraded = consent === 'all' && value === 'essential'
    writeConsent(value)
    setConsent(value)
    setReopened(false)
    // Yüklenmiş ölçüm betiği sayfada kalmasın: izin geri alınınca sayfa yenilenir.
    if (downgraded) window.setTimeout(() => window.location.reload(), 300)
  }

  const showBanner = consent === null || (consent !== undefined && reopened)

  return (
    <>
      {consent === 'all' && <SpeedInsights />}
      {showBanner && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Çerez tercihi"
          className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-line-strong bg-surface-1 p-5 shadow-2xl sm:flex-row sm:items-center">
            <p className="flex-1 text-[13.5px] leading-relaxed text-ink-muted">
              Sitenin çalışması için zorunlu çerezler kullanılır. İsterseniz site performansını ölçen isteğe bağlı araçlara da
              izin verebilirsiniz.{' '}
              <Link href="/legal?tab=cookies" className="text-ink underline underline-offset-2 hover:text-gold">
                Çerez Politikası
              </Link>
            </p>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => choose('essential')}
                aria-pressed={reopened ? consent === 'essential' : undefined}
                className={buttonClasses({ variant: 'secondary' })}
              >
                Yalnızca zorunlu
              </button>
              <button
                type="button"
                onClick={() => choose('all')}
                aria-pressed={reopened ? consent === 'all' : undefined}
                className={buttonClasses({ variant: 'secondary' })}
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
