'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import LandingHeader from '@/components/landing/LandingHeader'
import { Button } from '@/components/ui'

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

        // Rol DB'den okunur; user_metadata kullanıcı tarafından değiştirilebilir.
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
        const role = profile?.role ?? 'influencer'
        const path = role === 'brand' ? '/dashboard/brand' : role === 'admin' ? '/admin' : '/dashboard/influencer'
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
    <div className="min-h-screen bg-background text-ink">
      <LandingHeader />
      <main className="mx-auto max-w-[560px] px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="font-display text-[38px] font-normal leading-[1.1]">Teşekkürler</h1>
        <p className="mt-3 text-ink-muted">Geri bildirimin ekibe ulaştı. Değerli görüşlerin için teşekkür ederiz.</p>
        <p className="mt-2 text-[13px] text-ink-faint">
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Yönlendiriliyor…
            </span>
          ) : (
            '3 saniye içinde paneline dönüyorsun.'
          )}
        </p>
        {dashboardPath && (
          <Button className="mt-6" onClick={() => router.push(dashboardPath)}>
            Panele dön
          </Button>
        )}
      </main>
    </div>
  )
}
