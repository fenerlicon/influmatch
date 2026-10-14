'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

interface SignOutButtonProps {
  size?: 'default' | 'sm'
}

export default function SignOutButton({ size = 'default' }: SignOutButtonProps) {
  const router = useRouter()
  const { signOut } = useSupabaseAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      router.replace('/login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={size === 'sm' ? 'ghost' : 'secondary'}
      size={size === 'sm' ? 'sm' : 'md'}
      block={size !== 'sm'}
      onClick={handleSignOut}
      loading={isLoading}
      leftIcon={<LogOut />}
    >
      Çıkış yap
    </Button>
  )
}
