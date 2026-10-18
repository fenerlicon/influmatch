'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import { Building2, UserRound, Video, type LucideIcon } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
import PasswordInput from '@/components/auth/PasswordInput'
import { Button, Field, Input, Notice } from '@/components/ui'
import { cn } from '@/utils/cn'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import type { UserRole } from '@/types/auth'

// Hesap türü formun içinde (eski /signup-role sayfası buraya yönlenir).
// Influencer ve UGC aynı rol; fark creator_type (onboarding bunu ön seçili getirir).
type AccountKind = 'brand' | 'influencer' | 'ugc'

const KINDS: { value: AccountKind; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'brand', label: 'Marka', hint: 'İş birliği arıyorum', icon: Building2 },
  { value: 'influencer', label: 'Influencer', hint: 'Hesabımla tanıtım', icon: UserRound },
  { value: 'ugc', label: 'UGC', hint: 'Markaya içerik üretimi', icon: Video },
]

function initialKind(role: string | null, creatorType: string | null): AccountKind {
  if (role === 'brand') return 'brand'
  return creatorType === 'ugc' ? 'ugc' : 'influencer'
}

function SignupPageContent() {
  const searchParams = useSearchParams()
  // Yalnızca bilinen roller; URL'den gelen başka bir değer (ör. admin) metadata'ya yazılmaz.
  const [kind, setKind] = useState<AccountKind>(() => initialKind(searchParams.get('role'), searchParams.get('creator_type')))
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isAgreed, setIsAgreed] = useState(false)
  // Görevler: davet bağlantısı /signup?davet=KOD; kod isteğe bağlı, elle de yazılabilir.
  const [inviteCode, setInviteCode] = useState(() => (searchParams.get('davet') ?? '').trim().toUpperCase().slice(0, 12))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { signUpWithEmail, isSubmitting } = useSupabaseAuth()

  const role: UserRole = kind === 'brand' ? 'brand' : 'influencer'
  const isFormValid = useMemo(
    () => fullName.trim().length > 2 && email.includes('@') && password.length >= 6 && isAgreed,
    [fullName, email, password, isAgreed],
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid) return
    setErrorMessage(null)
    try {
      const response = await signUpWithEmail({
        email,
        password,
        fullName,
        role,
        creatorType: kind === 'brand' ? undefined : kind,
        inviteCode: /^[A-Z0-9]{6,12}$/.test(inviteCode) ? inviteCode : undefined,
      })
      if (response.error) {
        const message = response.error.message?.toLowerCase() || ''
        if (message.includes('already registered')) {
          // Not: e-posta adresleri gizli olduğu için users tablosunda e-posta ile arama yapılmaz.
          setErrorMessage('Bu e-posta adresi zaten kayıtlı.')
        } else if (message.includes('rate limit') || message.includes('too many requests') || message.includes('exceeded')) {
          // Hız sınırında e-posta gönderilmez; kullanıcı başarı sayfasına değil hataya düşmeli.
          setErrorMessage('Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin. Daha önce kayıt olduysanız e-postanızı kontrol edin.')
        } else {
          setErrorMessage(response.error.message || 'Bir hata oluştu.')
        }
        return
      }
      window.location.href = `/auth/check-email?email=${encodeURIComponent(email)}`
    } catch (error) {
      console.error('[Signup] Unexpected error:', error)
      setErrorMessage('Bir hata oluştu.')
    }
  }

  return (
    <AuthShell eyebrow="Kayıt" title="Ücretsiz başla">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-muted" id="kind-label">Hesap türü</span>
          <div role="radiogroup" aria-labelledby="kind-label" className="grid grid-cols-3 gap-2">
            {KINDS.map(({ value, label, hint, icon: Icon }) => {
              const on = kind === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKind(value)}
                  className={cn(
                    'grid gap-1.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                    on ? 'border-gold bg-gold/10' : 'border-line-strong bg-surface-1 hover:border-white/20',
                  )}
                >
                  <Icon className={cn('h-[18px] w-[18px]', on ? 'text-gold' : 'text-ink-muted')} aria-hidden />
                  <span className="text-[13.5px] font-medium text-ink">{label}</span>
                  <span className="text-[11.5px] leading-snug text-ink-faint">{hint}</span>
                </button>
              )
            })}
          </div>
        </div>

        <Field label={kind === 'brand' ? 'Marka adı' : 'Ad soyad'}>
          {(props) => (
            <Input
              {...props}
              autoComplete={kind === 'brand' ? 'organization' : 'name'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={kind === 'brand' ? 'Markanızın adı' : 'Adınız soyadınız'}
              required
            />
          )}
        </Field>
        <Field label="E-posta" hint={kind === 'brand' ? 'Kurumsal e-postayı daha sonra ayrıca doğrularsın.' : undefined}>
          {(props) => (
            <Input {...props} type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMessage(null) }} placeholder="ornek@mail.com" required />
          )}
        </Field>
        <Field label="Şifre">
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" minLength={6} required />
          )}
        </Field>

        <Field label="Davet kodu" hint="İsteğe bağlı">
          {(props) => (
            <Input
              {...props}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12))}
              placeholder="Örn. AB3K9QXZ"
              autoComplete="off"
            />
          )}
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-muted">
          <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-gold" required />
          <span>
            <Link href="/legal?tab=terms" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-[3px]">
              Kullanım Koşulları
            </Link>{' '}
            ve{' '}
            <Link href="/legal?tab=privacy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-[3px]">
              Gizlilik Politikası
            </Link>
            &apos;nı okudum ve kabul ediyorum.
          </span>
        </label>

        {errorMessage && <Notice tone="danger">{errorMessage}</Notice>}
        <Button type="submit" variant="primary" block className="h-[42px]" loading={isSubmitting} disabled={!isFormValid}>
          Hesap oluştur
        </Button>
        <p className="text-center text-[13px] text-ink-muted">
          Zaten hesabın var mı?{' '}
          <Link href="/login" className="text-gold hover:underline">
            Giriş yap
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageContent />
    </Suspense>
  )
}
