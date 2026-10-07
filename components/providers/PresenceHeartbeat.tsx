'use client'

import { useEffect } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

// Oturum açık ve sekme görünürken dakikada bir "buradayım" sinyali gönderir (touch_last_seen).
// Admin paneli çevrimiçi durumunu ve son görülme zamanını bundan hesaplar. Sunucu tarafı
// 45 saniyeden sık yazmaz; hata kullanıcıya gösterilmez.
const HEARTBEAT_MS = 60_000

export default function PresenceHeartbeat() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) return

    let stopped = false
    const beat = () => {
      if (stopped || document.visibilityState !== 'visible') return
      supabase.rpc('touch_last_seen').then(({ error }) => {
        if (error && process.env.NODE_ENV !== 'production') console.warn('[presence]', error.message)
      })
    }

    beat()
    const timer = window.setInterval(beat, HEARTBEAT_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [userId, supabase])

  return null
}
