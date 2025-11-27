'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabaseClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signInWithEmail, authError, isSubmitting } = useSupabaseAuth()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [accountDeletedError, setAccountDeletedError] = useState<string | null>(null)

  useEffect(() => {
    const error = searchParams.get('error')
    const message = searchParams.get('message')
    const verified = searchParams.get('verified')

    if (verified === 'true') {
      setSuccessMessage('Mail adresiniz doğrulanmıştır, lütfen tekrar giriş yapın.')
      // Clean URL after showing message
      router.replace('/login', { scroll: false })
    } else if (error === 'account_deleted') {
      setAccountDeletedError('Bu hesap silinmiş. Lütfen yeni bir hesap oluşturun.')
      router.replace('/login', { scroll: false })
    } else if (error === 'rate_limit' && message) {
      setAccountDeletedError(decodeURIComponent(message))
      router.replace('/login', { scroll: false })
    } else if (error === 'email_link_expired') {
      setAccountDeletedError('Email doğrulama linkinin süresi dolmuş. Lütfen yeni bir doğrulama emaili isteyin.')
      router.replace('/login', { scroll: false })
    } else if (error === 'verification_denied') {
      setAccountDeletedError('Email doğrulama işlemi reddedildi. Lütfen tekrar deneyin.')
      router.replace('/login', { scroll: false })
    } else if (error === 'verification_failed') {
      // Remove this error message as requested
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  const isFormValid = useMemo(() => email.includes('@') && password.length >= 6, [email, password])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid) return

    const { data, error } = await signInWithEmail({ email, password })

    if (!error && data.user) {
      setSuccessMessage('Giriş başarılı, profil bilgilerinizi tamamlamak için yönlendiriliyorsunuz...')
      // Redirect to dashboard - let the dashboard layout handle onboarding redirection if needed
      setTimeout(() => {
        router.push('/dashboard')
      }, 1200)
    }
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Giriş Yap</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Tekrar hoş geldin</h1>
          <p className="mt-2 text-gray-300">Email ve şifrenle giriş yaparak panelini aç.</p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label htmlFor="email" className="text-sm text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@influmatch.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm text-gray-300">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Şifreni gir"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full rounded-full bg-soft-gold px-8 py-4 font-semibold text-background transition hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm">
            {accountDeletedError && <p className="text-red-400">{accountDeletedError}</p>}
            {authError && <p className="text-red-400">{authError}</p>}
            {successMessage && <p className="text-emerald-400">{successMessage}</p>}
          </div>

          <p className="mt-8 text-sm text-gray-400">
            Henüz hesabın yok mu?{' '}
            <Link href="/signup-role" className="font-semibold text-soft-gold underline-offset-4 hover:underline">
              Hemen Başla
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

