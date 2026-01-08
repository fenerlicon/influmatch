'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Mail, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function CheckEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useSupabaseClient()
  const email = searchParams.get('email')

  // Updated to 8 digits
  const [code, setCode] = useState(['', '', '', '', '', '', '', ''])
  const [timeLeft, setTimeLeft] = useState(60)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
    // Allow verify if length is 6 or 8 (Supabase standard is usually 6, but user gets 8)
    if (otp.length < 6 || !email) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      })

      if (error) {
        setErrorMessage(error.message || 'Hatalı kod, lütfen tekrar deneyin.')
        setIsLoading(false)
      } else {
        setSuccessMessage('Hesabınız başarıyla doğrulandı! Yönlendiriliyorsunuz...')
        // Başarılı, Onboarding'e yönlendir
        setTimeout(() => {
          router.push('/onboarding')
        }, 1500)
      }
    } catch (err) {
      setErrorMessage('Bir hata oluştu.')
      setIsLoading(false)
    }
  }

  // Auto verify when code is full (8 chars) or 6 chars? Let's wait for user to click verify to be safe, or auto verify at 8.
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

    // Auto focus next input (limit 7 because array is 0-7)
    if (value && index < 7) {
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
    const pastedData = e.clipboardData.getData('text').slice(0, 8).split('') // Slice 8
    if (pastedData.length > 0 && pastedData.every(char => !isNaN(Number(char)))) {
      const newCode = [...code]
      pastedData.forEach((char, index) => {
        if (index < 8) newCode[index] = char
      })
      setCode(newCode)
      inputRefs.current[Math.min(pastedData.length, 7)]?.focus()
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
        setErrorMessage(error.message)
      } else {
        setSuccessMessage('Yeni kod gönderildi.')
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
      <main className="flex min-h-screen items-center justify-center px-6 py-24 bg-[#0F1014]">
        <div className="text-center">
          <h1 className="text-white text-xl">Email adresi bulunamadı.</h1>
          <Link href="/signup-role" className="text-soft-gold hover:underline mt-4 block">Tekrar Kayıt Ol</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24 bg-[#0F1014]">
      <div className="mx-auto max-w-lg w-full text-center">
        <div className="rounded-[32px] border border-white/10 bg-[#151621] p-8 md:p-12 shadow-2xl relative overflow-hidden">

          {/* Background Glows */}
          <div className="absolute top-0 right-0 h-64 w-64 bg-soft-gold rounded-full opacity-[0.03] blur-3xl -translate-y-10 translate-x-10 pointer-events-none" />

          <div className="flex justify-center mb-8">
            <div className="rounded-full bg-soft-gold/10 p-5 border border-soft-gold/20">
              <Mail className="h-8 w-8 text-soft-gold" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            Email Doğrulama
          </h1>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            <span className="text-white font-semibold">{email}</span> adresine gönderilen doğrulama kodunu girin.
          </p>

          {/* Wrapper to fit 8 boxes */}
          <div className="flex justify-center flex-wrap gap-2 mb-8" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                // Fix types for ref
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                // Smaller width for 8 params
                className={`w-9 h-12 md:w-10 md:h-14 rounded-lg border bg-white/5 text-center text-lg font-bold text-white transition-all focus:outline-none focus:ring-2 focus:ring-soft-gold/50 ${digit ? 'border-soft-gold/50' : 'border-white/10'
                  }`}
              />
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={isLoading || code.join('').length < 6}
            className="w-full rounded-2xl bg-soft-gold py-4 font-bold text-[#0B0F19] transition hover:bg-[#b89428] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? 'İşleniyor...' : (
              <>
                Doğrula <ArrowRight size={18} strokeWidth={2.5} />
              </>
            )}
          </button>

          <div className="mt-6 flex flex-col items-center gap-3">
            {errorMessage && (
              <p className="text-red-400 text-sm flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-lg">
                <AlertCircle size={14} /> {errorMessage}
              </p>
            )}
            {successMessage && (
              <p className="text-emerald-400 text-sm flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-lg">
                <CheckCircle size={14} /> {successMessage}
              </p>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
            <button
              onClick={handleResend}
              disabled={timeLeft > 0}
              className="text-sm text-gray-400 hover:text-white transition disabled:hover:text-gray-400"
            >
              {timeLeft > 0 ? (
                `Kodu tekrar göndermek için bekle: ${timeLeft}sn`
              ) : (
                <>
                  Kod gelmedi mi? <span className="text-soft-gold font-bold">Tekrar Gönder</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </main>
  )
}
