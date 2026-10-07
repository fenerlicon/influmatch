'use client'

import Link from 'next/link'
import { useState } from 'react'
import { requestPasswordReset } from './actions'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await requestPasswordReset(email)
      if (result.success) setSent(true)
      else setError(result.error ?? 'Bir hata oluştu, lütfen tekrar deneyin.')
    } catch {
      setError('Bir hata oluştu, lütfen tekrar deneyin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">ŞİFRE SIFIRLAMA</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Şifrenizi mi unuttunuz?</h1>

          {sent ? (
            <div className="mt-8 space-y-4 text-gray-300">
              <p>
                <span className="font-semibold text-white">{email.trim()}</span> adresi kayıtlıysa şifre sıfırlama
                bağlantısı gönderildi. Bağlantı 1 saat geçerlidir.
              </p>
              <p className="text-sm text-gray-400">
                Bağlantıyı bu formu doldurduğunuz tarayıcıda açın. E-posta gelmediyse spam klasörünü kontrol edin.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-gray-300">Hesabınızın e-posta adresini girin, size sıfırlama bağlantısı gönderelim.</p>
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
                <button
                  type="submit"
                  disabled={isSubmitting || !email.includes('@')}
                  className="w-full rounded-full bg-soft-gold px-8 py-4 font-semibold text-background transition hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
                </button>
              </form>
              {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
            </>
          )}

          <p className="mt-8 text-sm text-gray-400">
            <Link href="/login" className="font-semibold text-soft-gold underline-offset-4 hover:underline">
              Giriş sayfasına dön
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
