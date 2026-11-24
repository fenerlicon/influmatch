'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'
import { Button, Notice } from '@/components/ui'
import { cn } from '@/utils/cn'

// Supabase hata metinleri İngilizce gelir; kullanıcıya ne yapacağını söyleyen Türkçe karşılığını göster.
function verifyErrorMessage(message: string | undefined, resent: boolean): string {
  const m = (message || '').toLowerCase()
  if (m.includes('expired') || m.includes('invalid')) {
    return resent
      ? 'Kod geçersiz ya da süresi dolmuş. Yeni kod istediğin için eski e-postalardaki kodlar artık çalışmaz; yalnızca en son gelen e-postadaki kodu gir.'
      : 'Kod geçersiz ya da süresi dolmuş. Kodu kontrol et; olmadıysa aşağıdan yeni kod iste ve en son gelen e-postadaki kodu gir.'
  }
  if (m.includes('rate') || m.includes('too many') || m.includes('security purposes')) {
    return 'Çok sık denendi. Biraz bekleyip tekrar dene.'
  }
  return 'Doğrulama yapılamadı, lütfen tekrar dene.'
}

function CheckEmailPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabaseClient()
  const email = searchParams.get('email')

  // Updated to 6 digits (Supabase default OTP length)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [timeLeft, setTimeLeft] = useState(60)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Timer Countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft])

  const handleVerify = async () => {
    const otp = code.join('')
    // Projede doğrulama kodu 6 hane (canlıda kayıtlar bu kodla onaylanıyor).
    if (otp.length !== 6 || !email || isLoading) return

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      })

      if (error) {
        setErrorMessage(verifyErrorMessage(error.message, resent))
        // Kutuları boşalt: yeni kod yazılınca otomatik doğrulama tekrar çalışsın.
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
        setIsLoading(false)
      } else {
        setSuccessMessage('Hesabın doğrulandı. Profilini tamamlamaya yönlendiriliyorsun…')
        router.push('/onboarding')
      }
    } catch (err) {
      setErrorMessage('Bir hata oluştu.')
      setIsLoading(false)
    }
  }

  // Auto verify when code is full (6 chars)
  useEffect(() => {
    if (code.every(digit => digit !== '')) {
      handleVerify()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto focus next input (limit 5 because array is 0-5)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace handling
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('') // Slice 6
    if (pastedData.length > 0 && pastedData.every(char => !isNaN(Number(char)))) {
      const newCode = [...code]
      pastedData.forEach((char, index) => {
        if (index < 6) newCode[index] = char
      })
      setCode(newCode)
      inputRefs.current[Math.min(pastedData.length, 5)]?.focus()
    }
  }

  const handleResend = async () => {
    if (timeLeft > 0 || !email) return

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) {
        setErrorMessage(verifyErrorMessage(error.message, resent))
      } else {
        // Yeni kod eskisini geçersiz kılar; eski kodla deneme olmasın diye kutuları temizle.
        setResent(true)
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
        setSuccessMessage('Yeni kod gönderildi. Yalnızca bu son e-postadaki kod geçerli; önceki kodlar artık çalışmaz.')
        setTimeLeft(60)
      }
    } catch (err) {
      setErrorMessage('Bir hata oluştu.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!email) {
    return (
      <AuthShell eyebrow="E-posta doğrulama" title="E-posta adresi bulunamadı">
        <p className="text-[13px] text-ink-muted">
          <Link href="/signup" className="text-gold hover:underline">Kayıt sayfasına dön</Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="E-posta doğrulama"
      title="E-postanı kontrol et"
      description={<><span className="text-ink">{email}</span> adresine gönderilen 6 haneli kodu gir.</>}
    >
      <div className="grid gap-4">
        <div className="flex justify-between gap-2" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              aria-label={`${index + 1}. hane`}
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={cn(
                'h-14 w-full min-w-0 rounded-lg border bg-surface-2 text-center text-2xl font-semibold tabular-nums text-ink outline-none transition focus:border-gold/40 focus:ring-[3px] focus:ring-gold/10',
                digit ? 'border-gold/40' : 'border-line-strong',
              )}
            />
          ))}
        </div>

        {errorMessage && <Notice tone="danger">{errorMessage}</Notice>}
        {successMessage && <Notice tone="success">{successMessage}</Notice>}

        <Button variant="primary" block className="h-[42px]" onClick={handleVerify} loading={isLoading} disabled={code.join('').length < 6} rightIcon={<ArrowRight />}>
          Doğrula
        </Button>

        <p className="text-center text-[13px] text-ink-muted">
          {timeLeft > 0 ? (
            <>Kodu tekrar göndermek için {timeLeft} sn bekle</>
          ) : (
            <>
              Kod gelmedi mi?{' '}
              <button type="button" onClick={handleResend} disabled={isLoading} className="text-gold hover:underline disabled:opacity-50">
                Tekrar gönder
              </button>
            </>
          )}
        </p>
      </div>
    </AuthShell>
  )
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailPageContent />
    </Suspense>
  )
}
