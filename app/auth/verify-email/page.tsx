'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [email, setEmail] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    // Get email from session or localStorage
    const getEmail = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (user) {
        setEmail(user.email || null)
        
        // Check if email is already verified
        if (user.email_confirmed_at) {
          setIsVerified(true)
          setIsChecking(false)
          // Redirect to onboarding after a short delay
          setTimeout(() => {
            router.push('/onboarding')
          }, 2000)
          return
        }
      } else {
        // No user session, redirect to signup
        router.push('/signup')
        return
      }
      
      setIsChecking(false)
    }

    getEmail()
  }, [supabase, router])

  // Realtime subscription to check email verification using auth state change
  useEffect(() => {
    if (!email || isVerified) return

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.email_confirmed_at) {
          setIsVerified(true)
          // Redirect to onboarding
          setTimeout(() => {
            router.push('/onboarding')
          }, 1500)
        }
      }
    })

    // Also poll for verification status as backup
    const pollInterval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (user?.email_confirmed_at) {
        setIsVerified(true)
        clearInterval(pollInterval)
        setTimeout(() => {
          router.push('/onboarding')
        }, 1500)
      }
    }, 2000) // Check every 2 seconds

    return () => {
      subscription.unsubscribe()
      clearInterval(pollInterval)
    }
  }, [email, isVerified, supabase, router])

  const handleResendEmail = async () => {
    if (!email || isResending || resendCooldown > 0) return
    
    setIsResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        console.error('Resend email error:', error)
        
        const errorMsg = error.message?.toLowerCase() || ''
        
        // Check if it's a rate limit error
        if (errorMsg.includes('40 seconds') || 
            errorMsg.includes('rate limit') ||
            errorMsg.includes('too many requests') ||
            errorMsg.includes('rate limit exceeded') ||
            errorMsg.includes('exceeded')) {
          // Start 40 second cooldown
          setResendCooldown(40)
          alert('Email gönderme limiti aşıldı. Güvenlik nedeniyle 40 saniye beklemelisiniz. Lütfen daha sonra tekrar deneyin.')
        } else {
          alert(`Email gönderilirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`)
        }
      } else {
        // Success - start 40 second cooldown
        setResendCooldown(40)
        alert('Doğrulama emaili tekrar gönderildi. Lütfen email kutunuzu kontrol edin.')
      }
    } catch (error) {
      console.error('Resend email exception:', error)
      alert('Email gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.')
    } finally {
      setIsResending(false)
    }
  }

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [resendCooldown])

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-md text-center">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-10 shadow-glow">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-soft-gold" />
            <p className="mt-4 text-gray-300">Yükleniyor...</p>
          </div>
        </div>
      </main>
    )
  }

  if (isVerified) {
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
              Email adresiniz başarıyla doğrulandı. Profil bilgilerinizi tamamlamak için yönlendiriliyorsunuz...
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Yönlendiriliyorsunuz...</span>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md text-center">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-10 shadow-glow">
          <div className="flex justify-center">
            <div className="rounded-full bg-soft-gold/20 p-4">
              <Mail className="h-12 w-12 text-soft-gold" />
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-white">Email Adresinizi Doğrulayın</h1>
          <p className="mt-4 text-gray-300">
            <span className="font-semibold text-soft-gold">{email}</span> adresine doğrulama linki gönderdik.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Email kutunuzu kontrol edin ve doğrulama linkine tıklayın. Email gelmediyse spam klasörünü kontrol edin.
          </p>
          
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={isResending || resendCooldown > 0}
              className="w-full rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gönderiliyor...
                </>
              ) : resendCooldown > 0 ? (
                `Tekrar göndermek için ${resendCooldown} saniye bekleyin`
              ) : (
                'Email\'i Tekrar Gönder'
              )}
            </button>
            <Link
              href="/login"
              className="block w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
            >
              Giriş Sayfasına Dön
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-xs text-blue-300">
              <strong>Not:</strong> Email doğrulandıktan sonra otomatik olarak profil bilgilerinizi tamamlamak için yönlendirileceksiniz.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

