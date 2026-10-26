'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, AlertOctagon } from 'lucide-react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { Button, ButtonLink, Card } from '@/components/ui'
import AppealBox from '@/components/appeals/AppealBox'
import type { DecisionView } from '@/lib/moderation-shared'

/**
 * Reddedilmiş hesap. Karar kaydı varsa (2026-10-26) ret nedeni ve itiraz formu burada; yoksa (eski ret ya da tablo henüz yok)
 * destek e-postası.
 */
export default function RejectedScreen({ decision = null }: { decision?: DecisionView | null }) {
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

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md p-7 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
          <AlertOctagon className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[24px] leading-tight tracking-tight text-ink">
          {decision ? 'Hesabın onaylanmadı' : 'Hesabın askıya alındı'}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
          {decision
            ? 'Hesabın yönetici incelemesinde onaylanmadı. Nedeni aşağıda; karara bir kez itiraz edebilirsin.'
            : 'Hesabın yönetici tarafından reddedildi ya da kullanım koşullarına aykırılık nedeniyle askıya alındı. İtiraz için destek ekibine yazabilirsin.'}
        </p>
        {decision && <AppealBox decision={decision} className="mt-4 grid gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 text-left text-[13px]" />}
        <div className="mt-6 grid gap-2">
          {!decision && (
            <ButtonLink href="mailto:destek@influmatch.net" leftIcon={<Mail />}>
              İtiraz için yaz
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
