'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function VerifySuccessPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [countdown, setCountdown] = useState(3)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Check if user has completed onboarding (has username)
        const { data: profile } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()

        // User is authenticated, start countdown
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(interval)
              setIsRedirecting(true)
              
              // If user hasn't completed onboarding, redirect to onboarding
              if (!profile?.username) {
                router.push('/onboarding')
                return 0
              }
              
              // Redirect to dashboard based on role
              const role = user.user_metadata?.role || 'influencer'
              const dashboardPath = role === 'brand' ? '/dashboard/brand' : '/dashboard/influencer'
              router.push(dashboardPath)
              return 0
            }
            return prev - 1
          })
        }, 1000)

        return () => clearInterval(interval)
      } else {
        // No session, redirect to login
        router.push('/login')
      }
    }

    checkAuth()
  }, [supabase, router])

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md text-center">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-10 shadow-glow">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/20 p-4">
              <CheckCircle className="h-12 w-12 text-emerald-400" />
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-white">Tebrikler, Hesabınız Onaylandı!</h1>
          <p className="mt-4 text-gray-300 leading-relaxed">
            Email adresiniz başarıyla doğrulandı. Hesabınıza yönlendiriliyorsunuz...
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Yönlendiriliyorsunuz...</span>
              </>
            ) : (
              <>
                <span>{countdown} saniye sonra yönlendirileceksiniz</span>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
