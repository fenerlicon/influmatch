'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function ThankYouPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardPath, setDashboardPath] = useState<string | null>(null)

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    const getDashboardPath = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const role = user.user_metadata?.role ?? 'influencer'
        const path = role === 'brand' ? '/dashboard/brand' : '/dashboard/influencer'
        setDashboardPath(path)
        setIsLoading(false)

        // Redirect after 3 seconds
        timer = setTimeout(() => {
          router.push(path)
        }, 3000)
      } catch (error) {
        console.error('Error getting user role:', error)
        router.push('/login')
      }
    }

    getDashboardPath()

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-white sm:px-8 lg:px-20">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-12 text-center shadow-glow">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500/60 bg-emerald-500/20">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Teşekkürler!</h1>
          <p className="mt-4 text-gray-300">
            Geri bildiriminiz başarıyla gönderildi. Değerli görüşleriniz için teşekkür ederiz.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yönlendiriliyor...
              </span>
            ) : (
              '3 saniye içinde dashboard\'unuza yönlendirileceksiniz...'
            )}
          </p>
          {dashboardPath && (
            <button
              onClick={() => router.push(dashboardPath)}
              className="mt-6 rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30"
            >
              Dashboard'a Dön
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

