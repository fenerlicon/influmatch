'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
import { Button, Field, Input, Notice } from '@/components/ui'
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
    <AuthShell
      eyebrow="Şifre sıfırlama"
      title="Şifreni mi unuttun?"
      description={sent ? undefined : 'Hesabının e-posta adresini gir, sana sıfırlama bağlantısı gönderelim.'}
    >
      {sent ? (
        <div className="grid gap-4">
          <Notice tone="success" icon={MailCheck}>
            <span className="text-ink">{email.trim()}</span> kayıtlıysa sıfırlama bağlantısı gönderildi. Bağlantı 1 saat geçerlidir.
          </Notice>
          <p className="text-[13px] text-ink-muted">Bağlantıyı bu formu doldurduğun tarayıcıda aç. E-posta gelmediyse spam klasörüne bak.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="E-posta">
            {(props) => (
              <Input {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" required />
            )}
          </Field>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" variant="primary" block className="h-[42px]" loading={isSubmitting} disabled={!email.includes('@')}>
            Sıfırlama bağlantısı gönder
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-[13px] text-ink-muted">
        <Link href="/login" className="text-gold hover:underline">Giriş sayfasına dön</Link>
      </p>
    </AuthShell>
  )
}
