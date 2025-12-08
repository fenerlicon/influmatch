'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useMemo } from 'react'
import type { UserRole } from '@/types/auth'
import SignOutButton from './SignOutButton'
import SettingsButton from './SettingsButton'

const roleHomePath: Record<UserRole, string> = {
  influencer: '/dashboard/influencer',
  brand: '/dashboard/brand',
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

interface DashboardSidebarProps {
  role: UserRole
  fullName: string
  email?: string | null
  currentUserId?: string
}

export default function DashboardSidebar({ role, fullName, email, currentUserId }: DashboardSidebarProps) {
  const pathname = usePathname()

  const navItems = useMemo(() => {
    const map: Record<UserRole, Array<{ label: string; href: string }>> = {
      influencer: [
        { label: 'Ana Sayfa', href: roleHomePath.influencer },
        { label: 'Profilim', href: '/dashboard/influencer/profile' },
        { label: 'Vitrin', href: '/dashboard/influencer/discover' },
        { label: 'İlanlar', href: '/dashboard/influencer/advert' },
        { label: 'Teklifler', href: '/dashboard/offers' },
        { label: 'Mesajlar', href: '/dashboard/messages' },
        { label: 'Spotlight', href: '/dashboard/spotlight' },
        { label: 'Rozetlerim', href: '/dashboard/influencer/badges' },
      ],
      brand: [
        { label: 'Ana Sayfa', href: roleHomePath.brand },
        { label: 'Profilim', href: '/dashboard/brand/profile' },
        { label: 'Vitrin', href: '/dashboard/brand/discover' },
        { label: 'İlanlar', href: '/dashboard/brand/advert' },
        { label: 'Teklifler', href: '/dashboard/brand/offers' },
        { label: 'Mesajlar', href: '/dashboard/messages' },
        { label: 'Spotlight', href: '/dashboard/spotlight' },
        { label: 'Rozetler', href: '/dashboard/brand/badges' },
      ],
    }
    return map[role]
  }, [role])

  const isActive = (href: string) => {
    // For home pages, use exact match
    if (href === roleHomePath.influencer || href === roleHomePath.brand) {
      return pathname === href
    }
    // For other pages, check if pathname starts with the href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const renderNavLinks = (variant: 'vertical' | 'horizontal') =>
    navItems.map((item) => {
      return (
        <Link
          key={item.label}
          href={item.href}
          prefetch={true}
          scroll={true}
          className={cx(
            variant === 'vertical'
              ? 'w-full rounded-2xl border px-4 py-3 text-sm font-medium transition text-left'
              : 'rounded-full border px-4 py-2 text-xs font-semibold transition',
            isActive(item.href)
              ? 'border-soft-gold/80 bg-white/5 text-soft-gold shadow-[0_0_22px_rgba(212,175,55,0.45)]'
              : 'border-white/5 text-gray-300 hover:border-white/20 hover:text-white',
          )}
        >
          {item.label}
        </Link>
      )
    })

  return (
    <Fragment>
      <aside className="hidden w-full max-w-xs flex-col border-r border-white/5 bg-[#0B0C10] px-6 py-8 text-white lg:flex">
        <div className="mb-8 rounded-2xl border border-white/5 bg-gradient-to-b from-white/5 to-transparent p-5">
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">INFLUMATCH</p>
          <h2 className="mt-3 text-lg font-semibold">{fullName}</h2>
          {email && <p className="text-sm text-gray-400">{email}</p>}
        </div>

        <nav className="flex flex-1 flex-col gap-2">{renderNavLinks('vertical')}</nav>

        <div className="mt-8 border-t border-white/5 pt-6 space-y-2">
          <SettingsButton role={role} />
          <SignOutButton />
        </div>
      </aside>

      <div className="border-b border-white/5 bg-[#09090c]/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">INFLUMATCH</p>
            <p className="font-semibold text-white">{fullName}</p>
          </div>
          <div className="flex items-center gap-2">
            <SettingsButton role={role} size="sm" />
            <SignOutButton size="sm" />
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto">{renderNavLinks('horizontal')}</div>
      </div>
    </Fragment>
  )
}
