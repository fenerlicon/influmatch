'use client'

import type { UserRole } from '@/types/auth'
import NotificationsPopover from './NotificationsPopover'

interface DashboardHeaderProps {
  fullName: string
  role: UserRole
  userId: string
}

export default function DashboardHeader({ fullName, role, userId }: DashboardHeaderProps) {
  return (
    <header className="relative z-50 border-b border-white/5 bg-[#101117]/80 px-4 py-4 text-white backdrop-blur lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">PANEL</p>
          <h1 className="mt-1 text-xl font-semibold">{fullName}</h1>
          <p className="text-sm text-gray-400">{role === 'brand' ? 'Marka' : 'Influencer'} Hesabı</p>
        </div>

        <div className="flex flex-col items-end gap-2 text-sm text-gray-300 sm:flex-row sm:items-center">
          <NotificationsPopover userId={userId} />
          <span className="rounded-full border border-white/15 px-4 py-1 text-xs uppercase tracking-[0.2em] text-soft-gold">
            {role === 'brand' ? 'Marka' : 'Influencer'}
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400">PREMIUM</span>
        </div>
      </div>
    </header>
  )
}
