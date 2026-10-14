'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AuthShell from '@/components/auth/AuthShell'
import PasswordInput from '@/components/auth/PasswordInput'
import { Button, Field, Notice } from '@/components/ui'
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

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  return (
    <AuthShell eyebrow="Şifre sıfırlama" title="Yeni şifreni belirle">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <Field label="Yeni şifre" hint="En az 6 karakter">
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          )}
        </Field>
        <Field label="Yeni şifre (tekrar)" error={mismatch ? 'Şifreler eşleşmiyor.' : undefined}>
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
          )}
        </Field>
        {error && (
          <Notice
            tone="danger"
            action={
              error.includes('süresi doldu') ? (
                <Link href="/forgot-password" className="text-[12.5px] text-gold hover:underline">Yeni bağlantı iste</Link>
              ) : undefined
            }
          >
            {error}
          </Notice>
        )}
        <Button type="submit" variant="primary" block className="h-[42px]" loading={isSubmitting} disabled={password.length < 6 || mismatch}>
          Şifreyi güncelle
        </Button>
      </form>
    </AuthShell>
  )
}
