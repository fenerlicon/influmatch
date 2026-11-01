'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

export default function SignOutButton() {
  const { signOut } = useSupabaseAuth()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-label="Çıkış yap"
      title="Çıkış yap"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await signOut()
          window.location.assign('/login')
        } finally {
          setBusy(false)
        }
      }}
    >
      {!busy && <LogOut />}
    </Button>
  )
}
