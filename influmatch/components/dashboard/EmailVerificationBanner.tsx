'use client'

import { useState, useTransition } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Mail, X, Loader2 } from 'lucide-react'

interface EmailVerificationBannerProps {
  userEmail: string
}

export default function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const supabase = useSupabaseClient()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isResending, startTransition] = useTransition()
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const handleResendEmail = () => {
    startTransition(async () => {
      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: userEmail,
        })

        if (error) {
          setResendMessage('Email gönderilemedi. Lütfen tekrar deneyin.')
          setTimeout(() => setResendMessage(null), 5000)
        } else {
          setResendMessage('Doğrulama emaili tekrar gönderildi! Lütfen email kutunuzu kontrol edin.')
          setTimeout(() => setResendMessage(null), 5000)
        }
      } catch (error) {
        setResendMessage('Bir hata oluştu. Lütfen tekrar deneyin.')
        setTimeout(() => setResendMessage(null), 5000)
      }
    })
  }

  if (isDismissed) return null

  return (
    <div className="border-b border-orange-500/30 bg-orange-500/10 px-4 py-3 sm:px-6 lg:px-10">
      <div className="mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 text-sm text-orange-200">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 flex-shrink-0 text-orange-400" />
          <p>
            <strong>Email adresinizi doğrulayın:</strong> Email adresinize gönderilen doğrulama linkine tıklayarak hesabınızı aktifleştirin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={isResending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-400/40 bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-200 transition hover:border-orange-400 hover:bg-orange-500/30 whitespace-nowrap disabled:opacity-50"
          >
            {isResending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Mail className="h-3.5 w-3.5" />
                Email Tekrar Gönder
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="rounded-lg p-1.5 text-orange-300 transition hover:bg-orange-500/20"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {resendMessage && (
          <p className="text-xs text-orange-100 sm:col-span-2">{resendMessage}</p>
        )}
      </div>
    </div>
  )
}

