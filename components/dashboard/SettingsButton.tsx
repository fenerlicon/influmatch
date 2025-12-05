'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types/auth'

interface SettingsButtonProps {
  role: UserRole
  size?: 'default' | 'sm'
}

const settingsPaths: Record<UserRole, string> = {
  influencer: '/dashboard/influencer/settings',
  brand: '/dashboard/brand/settings',
}

export default function SettingsButton({ role, size = 'default' }: SettingsButtonProps) {
  const pathname = usePathname()
  const isActive = pathname === settingsPaths[role]

  const baseClasses =
    'flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:border-soft-gold/70 hover:bg-soft-gold/10 hover:text-soft-gold'

  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1 text-xs'
      : 'w-full px-4 py-3 shadow-[0_0_18px_rgba(212,175,55,0.25)]'

  const activeClasses = isActive
    ? 'border-soft-gold/80 bg-soft-gold/10 text-soft-gold shadow-[0_0_22px_rgba(212,175,55,0.45)]'
    : ''

  return (
    <Link
      href={settingsPaths[role]}
      className={`${baseClasses} ${sizeClasses} ${activeClasses}`}
    >
      Ayarlar
    </Link>
  )
}
