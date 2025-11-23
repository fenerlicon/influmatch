'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function VerifySuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabaseClient()
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardPath, setDashboardPath] = useState<string | null>(null)

  useEffect(() => {
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
        setTimeout(() => {
          const next = searchParams.get('next')
          router.push(next || path)
        }, 3000)
      } catch (error) {
        console.error('Error getting user role:', error)
        router.push('/login')
      }
    }

    getDashboardPath()
  }, [router, supabase, searchParams])

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md text-center">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-10 shadow-glow">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/20 p-4">
              <CheckCircle className="h-12 w-12 text-emerald-400" />
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-white">Email Doğrulandı!</h1>
          <p className="mt-2 text-gray-300">
            Email adresiniz başarıyla doğrulandı. Hesabınız artık aktif.
          </p>
          {isLoading ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Yönlendiriliyorsunuz...</span>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <Link
                href={dashboardPath || '/dashboard'}
                className="block w-full rounded-2xl bg-soft-gold px-6 py-3 font-semibold text-background transition hover:bg-champagne"
              >
                Dashboard'a Git
              </Link>
              <p className="text-xs text-gray-400">
                3 saniye içinde otomatik olarak yönlendirileceksiniz...
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

