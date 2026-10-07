'use client'

import Link from 'next/link'

interface SidebarLinkProps {
    href: string
    label: string
    isActive: boolean
    variant?: 'vertical' | 'horizontal'
    unreadCount?: number
}

export default function SidebarLink({ href, label, isActive, variant = 'vertical', unreadCount = 0 }: SidebarLinkProps) {
    const isMessages = href === '/dashboard/messages'

    const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

    return (
        <Link
            href={href}
            prefetch={true}
            scroll={true}
            className={cx(
                variant === 'vertical'
                    ? 'relative w-full rounded-2xl border px-4 py-3 text-sm font-medium transition text-left flex items-center justify-between'
                    : 'relative rounded-full border px-4 py-2 text-xs font-semibold transition',
                isActive
                    ? 'border-soft-gold/80 bg-white/5 text-soft-gold shadow-[0_0_22px_rgba(212,175,55,0.45)]'
                    : 'border-white/5 text-gray-300 hover:border-white/20 hover:text-white',
            )}
        >
            <span>{label}</span>
            {unreadCount > 0 && isMessages && (
                <span className={cx(
                    variant === 'vertical'
                        ? "ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-glow"
                        : "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-glow"
                )}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    )
}
