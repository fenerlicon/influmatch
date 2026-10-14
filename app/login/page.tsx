'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import AuthShell from '@/components/auth/AuthShell'
import PasswordInput from '@/components/auth/PasswordInput'
import { Button, Field, Input, Notice } from '@/components/ui'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

// URL'deki durum kodları → gösterilecek bildirim (URL'den gelen serbest metin gösterilmez).
const NOTICES: Record<string, { tone: 'success' | 'danger'; text: string }> = {
  password_reset: { tone: 'success', text: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' },
  verified: { tone: 'success', text: 'E-posta adresiniz doğrulandı, lütfen giriş yapın.' },
  deleted: { tone: 'success', text: 'Hesabınız ve verileriniz silindi.' },
  rate_limit: { tone: 'danger', text: 'Sistem şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.' },
  email_link_expired: { tone: 'danger', text: 'E-posta bağlantısının süresi dolmuş veya bağlantı daha önce kullanılmış. Şifre sıfırlıyorsanız yeni bağlantı isteyin.' },
  verification_denied: { tone: 'danger', text: 'Doğrulama reddedildi.' },
  verification_failed: { tone: 'danger', text: 'Bağlantı doğrulanamadı. Bağlantıyı isteği yaptığınız tarayıcıda açın veya yeni bir bağlantı isteyin.' },
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<(typeof NOTICES)[string] | null>(null)
  const { signInWithEmail, authError, isSubmitting } = useSupabaseAuth()

  // Durum kodu bir kez okunur, adres temizlenir
  useEffect(() => {
    const key =
      searchParams.get('password_reset') === 'true' ? 'password_reset'
        : searchParams.get('verified') === 'true' ? 'verified'
          : searchParams.get('deleted') === 'true' ? 'deleted'
            : searchParams.get('error')
    if (key && NOTICES[key]) {
      setNotice(NOTICES[key])
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  const isFormValid = useMemo(() => email.includes('@') && password.length >= 6, [email, password])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid) {
      toast.error('Geçerli bir e-posta ve en az 6 karakterli şifre girin.')
      return
    }
    const { data, error } = await signInWithEmail({ email, password })
    if (!error && data.user) {
      // Yalnızca site içi yollar (açık yönlendirme olmasın).
      const from = searchParams.get('redirectedFrom')
      const target = from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/\\') ? from : '/dashboard'
      router.push(target)
    }
  }

  return (
    <AuthShell eyebrow="Giriş" title="Tekrar hoş geldin">
      <form onSubmit={handleSubmit} className="grid gap-4">
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <Field label="E-posta">
          {(props) => (
            <Input {...props} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" required />
          )}
        </Field>
        <Field
          label="Şifre"
          aside={
            <Link href="/forgot-password" className="text-[12.5px] text-ink-muted hover:text-ink">
              Şifremi unuttum
            </Link>
          }
        >
          {(props) => (
            <PasswordInput {...props} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          )}
        </Field>
        {authError && <Notice tone="danger">{authError}</Notice>}
        <Button type="submit" variant="primary" block className="h-[42px]" loading={isSubmitting} disabled={!isFormValid}>
          Giriş yap
        </Button>
        <p className="text-center text-[13px] text-ink-muted">
          Hesabın yok mu?{' '}
          <Link href="/signup" className="text-gold hover:underline">
            Ücretsiz başla
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
