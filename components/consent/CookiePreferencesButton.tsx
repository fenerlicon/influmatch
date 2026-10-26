'use client'

import { COOKIE_PREFERENCES_EVENT } from '@/lib/consent-shared'

/** Çerez tercihini sonradan değiştirmek için banner'ı yeniden açar (alt bilgi, ayarlar). */
export default function CookiePreferencesButton({ className, children = 'Çerez tercihleri' }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}>
      {children}
    </button>
  )
}
