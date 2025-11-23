'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { UserRole } from '@/types/auth'

const ROLE_TITLES: Record<UserRole, string> = {
  influencer: 'Influencerım',
  brand: 'Markayım',
}

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabaseClient()
  const defaultRole = (searchParams.get('role') as UserRole) || 'influencer'

  const [role, setRole] = useState<UserRole>(defaultRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isAgreed, setIsAgreed] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { signUpWithEmail, isSubmitting } = useSupabaseAuth()

  useEffect(() => {
    if (defaultRole && defaultRole !== role) {
      setRole(defaultRole)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRole])

  // Clear error when form is reset or email changes
  useEffect(() => {
    if (email) {
      setErrorMessage(null)
    }
  }, [email])

  const isFormValid = useMemo(() => {
    return fullName.trim().length > 2 && email.includes('@') && password.length >= 6 && isAgreed
  }, [fullName, email, password, isAgreed])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid) return

    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await signUpWithEmail({
      email,
      password,
      fullName,
      role,
    })

    if (error) {
      // Check if it's a "user already registered" error
      if (error.message?.toLowerCase().includes('user already registered') || 
          error.message?.toLowerCase().includes('already registered')) {
        // Check if user exists in public.users
        const { data: publicUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (!publicUser) {
          // Auth user exists but public.users doesn't - account was deleted
          setErrorMessage('Bu email adresi ile daha önce bir hesap oluşturulmuş ancak hesap silinmiş. Yeni bir hesap oluşturmak için lütfen farklı bir email adresi kullanın veya destek ekibiyle iletişime geçin.')
          return
        } else {
          // User exists in public.users - normal "already registered" error
          setErrorMessage('Bu email adresi zaten kayıtlı. Giriş yapmayı deneyin.')
          return
        }
      }
      // Other errors - use the error message from the hook's translation
      setErrorMessage(error.message || 'Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.')
      return
    }

    // Success
    setSuccessMessage('Kayıt başarılı! Şimdi profilini tamamlayalım.')
    setFullName('')
    setEmail('')
    setPassword('')
    setTimeout(() => {
      router.push('/onboarding')
    }, 1000)
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-4xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Kayıt Ol</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Influmatch hesabını oluştur</h1>
          <p className="mt-2 text-gray-300">
            Rolün: <span className="text-soft-gold">{ROLE_TITLES[role]}</span>
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Rolünü değiştirmek ister misin?{' '}
            <Link href="/signup-role" className="font-semibold text-soft-gold underline-offset-4 hover:underline">
              Rol Seçimine Dön
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label htmlFor="fullName" className="text-sm text-gray-300">
                Ad Soyad
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Örn. Ayşe Yılmaz"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                required
              />
            </div>
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
                placeholder="Minimum 6 karakter"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                minLength={6}
                required
              />
            </div>

            {/* Legal Agreement Checkbox */}
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <input
                id="legalAgreement"
                type="checkbox"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-1 h-5 w-5 cursor-pointer rounded border-white/20 bg-white/5 text-soft-gold focus:ring-2 focus:ring-soft-gold focus:ring-offset-2 focus:ring-offset-background"
                required
              />
              <label htmlFor="legalAgreement" className="flex-1 cursor-pointer text-sm text-gray-300">
                <Link
                  href="/legal?tab=terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-soft-gold underline-offset-4 hover:underline"
                >
                  Kullanıcı Sözleşmesi
                </Link>
                'ni ve{' '}
                <Link
                  href="/legal?tab=privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-soft-gold underline-offset-4 hover:underline"
                >
                  Aydınlatma Metni
                </Link>
                'ni okudum, verilerimin işlenmesine açık rıza veriyorum.
              </label>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full rounded-full bg-soft-gold px-8 py-4 font-semibold text-background transition hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Hesabımı Oluştur'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm">
            {errorMessage && <p className="text-red-400">{errorMessage}</p>}
            {successMessage && <p className="text-emerald-400">{successMessage}</p>}
          </div>

          <p className="mt-8 text-sm text-gray-400">
            Zaten hesabın var mı?{' '}
            <Link href="/login" className="font-semibold text-soft-gold underline-offset-4 hover:underline">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

