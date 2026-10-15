'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import { Button, Input, Notice } from '@/components/ui'
import { confirmCorporateEmailCode, resendCorporateEmailCode, submitCorporateEmail } from '@/app/dashboard/brand/profile/corporate-email-actions'
import { validateCorporateEmail } from '@/lib/corporate-email'

interface CorporateEmailVerificationProps {
  initialEmail: string | null
  verified: boolean
  website: string
}

export default function CorporateEmailVerification({ initialEmail, verified, website }: CorporateEmailVerificationProps) {
  const router = useRouter()
  const [email, setEmail] = useState(initialEmail ?? '')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(!!initialEmail && !verified)
  const [isVerified, setIsVerified] = useState(verified)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const changed = email.trim().toLowerCase() !== (initialEmail ?? '').toLowerCase()
  const validation = email.trim() ? validateCorporateEmail(email, website) : null
  const inlineError = validation && !validation.isValid ? validation.error : null

  const act = (task: () => Promise<{ success: boolean; message?: string; error?: string }>, onSuccess?: () => void) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await task()
      if (result.success) {
        setMessage(result.message ?? null)
        onSuccess?.()
        router.refresh()
      } else {
        setError(result.error ?? 'İşlem başarısız.')
      }
    })
  }

  return (
    <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-4">
      <div>
        <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
          <Mail className="h-4 w-4 text-gold" aria-hidden /> Kurumsal e-posta
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          &quot;Resmi İşletme&quot; rozeti için web sitenizin alan adına ait bir e-postayı (ör. ad@markaniz.com) kodla doğrulamanız
          gerekir. Giriş e-postanızdan farklı olabilir.
        </p>
      </div>

      {isVerified && !changed ? <Notice tone="success">{initialEmail} doğrulandı.</Notice> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          aria-label="Kurumsal e-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ad@markaniz.com"
          className="flex-1"
          aria-invalid={inlineError ? true : undefined}
        />
        {(changed || !isVerified) && (
          <Button
            disabled={!!inlineError || !email.trim()}
            loading={isPending}
            onClick={() =>
              act(
                () => (changed ? submitCorporateEmail(email) : resendCorporateEmailCode()),
                () => {
                  setCodeSent(true)
                  setIsVerified(false)
                },
              )
            }
          >
            {changed ? 'Kaydet ve kod gönder' : 'Kodu tekrar gönder'}
          </Button>
        )}
      </div>
      {inlineError && <p className="text-xs text-danger">{inlineError}</p>}
      {changed && isVerified && <p className="text-xs text-warning">E-postayı değiştirirseniz yeni adres doğrulanana kadar sarı tikiniz kalkar.</p>}

      {codeSent && !isVerified && !changed && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Doğrulama kodu"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6 haneli kod"
            className="font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal sm:w-48"
          />
          <Button variant="primary" loading={isPending} disabled={code.length !== 6} onClick={() => act(() => confirmCorporateEmailCode(code), () => setIsVerified(true))}>
            Doğrula
          </Button>
        </div>
      )}

      {message && <p className="text-xs text-success">{message}</p>}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
