'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react'
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
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Mail className="h-4 w-4 text-soft-gold" /> Kurumsal E-posta
        </p>
        <p className="mt-1 text-xs text-gray-400">
          &quot;Resmi İşletme&quot; rozeti için web sitenizin alan adına ait bir e-postayı (ör. ad@markaniz.com) kodla doğrulamanız
          gerekir. Giriş e-postanızdan farklı olabilir.
        </p>
      </div>

      {isVerified && !changed ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <CheckCircle className="h-4 w-4" /> {initialEmail} doğrulandı.
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ad@markaniz.com"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
        />
        {(changed || !isVerified) && (
          <button
            type="button"
            disabled={isPending || !!inlineError || !email.trim()}
            onClick={() =>
              act(
                () => (changed ? submitCorporateEmail(email) : resendCorporateEmailCode()),
                () => {
                  setCodeSent(true)
                  setIsVerified(false)
                },
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2.5 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {changed ? 'Kaydet ve kod gönder' : 'Kodu tekrar gönder'}
          </button>
        )}
      </div>
      {inlineError && <p className="text-xs text-red-300">{inlineError}</p>}
      {changed && isVerified && (
        <p className="text-xs text-yellow-200">E-postayı değiştirirseniz yeni adres doğrulanana kadar sarı tikiniz kalkar.</p>
      )}

      {codeSent && !isVerified && !changed && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6 haneli kod"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm tracking-widest text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-500 focus:border-soft-gold focus:outline-none sm:w-48"
          />
          <button
            type="button"
            disabled={isPending || code.length !== 6}
            onClick={() => act(() => confirmCorporateEmailCode(code), () => setIsVerified(true))}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-soft-gold px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Doğrula
          </button>
        </div>
      )}

      {message && <p className="text-xs text-emerald-300">{message}</p>}
      {error && (
        <p className="flex items-start gap-2 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
