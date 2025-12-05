'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
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

  const baseClasses =
    'flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:border-soft-gold/70 hover:bg-soft-gold/10 hover:text-soft-gold'

  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1 text-xs'
      : 'w-full px-4 py-3 shadow-[0_0_18px_rgba(212,175,55,0.25)]'

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className={`${baseClasses} ${sizeClasses} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {isLoading ? 'Çıkış Yapılıyor...' : 'Çıkış Yap'}
    </button>
  )
}
