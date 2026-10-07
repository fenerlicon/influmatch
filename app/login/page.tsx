'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState, useEffect } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { toast } from 'sonner'

function LoginPageContent() {
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
    const verified = searchParams.get('verified')

    if (searchParams.get('password_reset') === 'true') {
      setSuccessMessage('Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.')
      router.replace('/login', { scroll: false })
    } else if (verified === 'true') {
      setSuccessMessage('Mail adresiniz doğrulanmıştır, lütfen tekrar giriş yapın.')
      router.replace('/login', { scroll: false })
    } else if (error === 'account_deleted') {
      setAccountDeletedError('Hesabınız silinmiştir.')
      router.replace('/login', { scroll: false })
    } else if (error === 'rate_limit') {
      // URL'deki metin gösterilmez: herkes ?message= ile giriş sayfasında istediği yazıyı gösterebiliyordu.
      setAccountDeletedError('Sistem şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.')
      router.replace('/login', { scroll: false })
    } else if (error === 'email_link_expired') {
      setAccountDeletedError('E-posta bağlantısının süresi dolmuş veya bağlantı daha önce kullanılmış. Şifre sıfırlıyorsanız yeni bağlantı isteyin.')
      router.replace('/login', { scroll: false })
    } else if (error === 'verification_denied') {
      setAccountDeletedError('Doğrulama reddedildi.')
      router.replace('/login', { scroll: false })
    } else if (error === 'verification_failed') {
      setAccountDeletedError('Bağlantı doğrulanamadı. Bağlantıyı isteği yaptığınız tarayıcıda açın veya yeni bir bağlantı isteyin.')
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  const isFormValid = useMemo(() => email.includes('@') && password.length >= 6, [email, password])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid) {
      toast.error('Lütfen geçerli bir email ve en az 6 karakterli şifre girin.')
      return
    }

    const { data, error } = await signInWithEmail({ email, password })

    if (!error && data.user) {
      setSuccessMessage('Giriş başarılı! Yönlendiriliyorsunuz...')
      setTimeout(() => {
        // Yalnızca site içi yollar (açık yönlendirme olmasın).
        const from = searchParams.get('redirectedFrom')
        const target = from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/\\') ? from : '/dashboard'
        router.push(target)
      }, 1200)
    }
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">GİRİŞ YAP</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Hesabınıza Giriş Yapın</h1>
          <p className="mt-2 text-gray-300">Hoş geldiniz! Lütfen bilgilerinizi girin.</p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label htmlFor="email" className="text-sm text-gray-300">
                E-posta Adresi
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@mail.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm text-gray-300">
                  Şifre
                </label>
                <Link href="/forgot-password" className="text-sm text-soft-gold underline-offset-4 hover:underline">
                  Şifremi unuttum
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full rounded-full px-8 py-4 font-semibold text-background transition ${isFormValid
                ? 'bg-soft-gold hover:bg-champagne'
                : 'cursor-not-allowed bg-gray-600 opacity-50'
                }`}
            >
              {isSubmitting ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm">
            {accountDeletedError && <p className="text-red-400">{accountDeletedError}</p>}
            {authError && <p className="text-red-400">{authError}</p>}
            {successMessage && <p className="text-emerald-400">{successMessage}</p>}
          </div>

          <p className="mt-8 text-sm text-gray-400">
            Hesabınız yok mu?{' '}
            <Link href="/signup-role" className="font-semibold text-soft-gold underline-offset-4 hover:underline">
              Hemen Başla
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
