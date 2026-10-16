'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, ButtonLink, Card } from '@/components/ui'
import { Lock, Mail, UserCheck, ShieldAlert, ArrowRight } from 'lucide-react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

interface BrandLockScreenProps {
  status?: 'pending' | 'rejected'
}

export default function BrandLockScreen({ status = 'pending' }: BrandLockScreenProps) {
  const router = useRouter()
  const { signOut } = useSupabaseAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isPending = status === 'pending'

  return (
    <div className="grid min-h-[60vh] place-items-center p-4">
      <Card className="w-full max-w-lg p-7 text-center">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl border ${isPending ? 'border-gold/30 bg-gold/10 text-gold' : 'border-danger/30 bg-danger/10 text-danger'}`}>
          {isPending ? <Lock className="h-6 w-6" aria-hidden /> : <ShieldAlert className="h-6 w-6" aria-hidden />}
        </span>
        <h2 className="mt-4 font-display text-[24px] leading-tight tracking-tight text-ink">
          {isPending ? 'Hesap onayı bekleniyor' : 'Erişim engellendi'}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
          {isPending
            ? 'Keşfet’i, ayrıntılı istatistikleri ve iş birliği tekliflerini görmek için hesabının onaylanması gerekiyor. Güvenli bir topluluk için markaları tek tek inceliyoruz.'
            : 'Hesabın onaylanmadı ya da kullanım koşullarına aykırılık nedeniyle askıya alındı. Ayrıntılar için destek ekibine yazabilirsin.'}
        </p>

        {isPending && (
          <ol className="mt-5 grid gap-2.5 rounded-xl border border-line bg-surface-2 p-4 text-left text-[13px]">
            <li className="flex items-center gap-2.5 text-ink">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-success/15 text-success">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
              </span>
              Hesap kaydı ve profil kurulumu
              <span className="ml-auto text-xs text-success">Tamamlandı</span>
            </li>
            <li className="flex items-center gap-2.5 text-ink">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-gold/15">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
              </span>
              Yönetici incelemesi
              <span className="ml-auto text-xs text-gold">Bekleniyor</span>
            </li>
          </ol>
        )}

        <div className="mt-6 grid gap-2">
          {isPending ? (
            <ButtonLink href="/dashboard/brand/profile" variant="primary" rightIcon={<ArrowRight />}>
              Profilini tamamla
            </ButtonLink>
          ) : (
            <ButtonLink href="mailto:destek@influmatch.net" leftIcon={<Mail />}>
              destek@influmatch.net
            </ButtonLink>
          )}
          <Button variant="ghost" onClick={handleSignOut} loading={isLoading}>
            Çıkış yap
          </Button>
        </div>
      </Card>
    </div>
  )
}
