'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { completePasswordReset } from './actions'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await completePasswordReset(password, confirmPassword)
      if (result.success) {
        router.replace('/login?password_reset=true')
        router.refresh()
        return
      }
      setError(result.error ?? 'Şifre güncellenemedi.')
    } catch {
      setError('Şifre güncellenemedi. Lütfen tekrar deneyin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none'

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">ŞİFRE SIFIRLAMA</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Yeni şifrenizi belirleyin</h1>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label htmlFor="password" className="text-sm text-gray-300">
                Yeni Şifre
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                minLength={6}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="text-sm text-gray-300">
                Yeni Şifre (Tekrar)
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                minLength={6}
                className={inputClass}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || password.length < 6}
              className="w-full rounded-full bg-soft-gold px-8 py-4 font-semibold text-background transition hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>

          {error && (
            <p className="mt-6 text-sm text-red-400">
              {error}{' '}
              {error.includes('süresi doldu') && (
                <Link href="/forgot-password" className="font-semibold text-soft-gold underline-offset-4 hover:underline">
                  Yeni bağlantı iste
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
