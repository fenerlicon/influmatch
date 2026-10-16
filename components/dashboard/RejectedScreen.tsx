'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, AlertOctagon } from 'lucide-react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { Button, ButtonLink, Card } from '@/components/ui'

export default function RejectedScreen() {
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
        <h1 className="mt-4 font-display text-[24px] leading-tight tracking-tight text-ink">Hesabın askıya alındı</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
          Hesabın yönetici tarafından reddedildi ya da kullanım koşullarına aykırılık nedeniyle askıya alındı. İtiraz için destek ekibine
          yazabilirsin.
        </p>
        <div className="mt-6 grid gap-2">
          <ButtonLink href="mailto:destek@influmatch.net" leftIcon={<Mail />}>
            İtiraz için yaz
          </ButtonLink>
          <Button variant="ghost" onClick={handleSignOut} loading={isLoading}>
            Çıkış yap
          </Button>
        </div>
      </Card>
    </div>
  )
}
