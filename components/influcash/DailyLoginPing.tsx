'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { dailyInflucashAction } from '@/app/dashboard/influcash/actions'
import { istanbulDay } from '@/lib/influcash-shared'

const KEY = 'im_influcash_daily'

/** Günlük giriş ödülü (Influcash): panel açılınca İstanbul günü başına bir kez sunucuya sorar. Asıl tekrar kontrolü sunucuda. */
export default function DailyLoginPing() {
  const router = useRouter()
  useEffect(() => {
    const today = istanbulDay()
    try {
      if (window.localStorage.getItem(KEY) === today) return
      window.localStorage.setItem(KEY, today)
    } catch {
      // Depolama kapalıysa her açılışta sorulur; sunucu ikinci ödülü yazmaz.
    }
    dailyInflucashAction()
      .then((r) => {
        if (r.awarded > 0) {
          toast.success(`+${r.awarded} Influcash`)
          router.refresh()
        }
      })
      .catch(() => null)
  }, [router])
  return null
}
