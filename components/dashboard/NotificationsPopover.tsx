'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Info, AlertTriangle, CheckCircle, Loader2, Trash2 } from 'lucide-react'
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, deleteAllNotifications } from '@/app/actions/notifications'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface Notification {
    id: string
    title: string
    message: string
    type: 'system' | 'info' | 'warning' | 'success'
    is_read: boolean
    created_at: string
    link?: string
}

interface NotificationsPopoverProps {
    userId: string
}

export default function NotificationsPopover({ userId }: NotificationsPopoverProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)
    const popoverRef = useRef<HTMLDivElement>(null)
    const supabase = createSupabaseBrowserClient()

    const fetchNotifications = async () => {
        setIsLoading(true)
        const { success, data } = await getNotifications(userId)
        if (success && data) {
            setNotifications(data as Notification[])
            setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        fetchNotifications()

        const channel = supabase
            .channel(`notifications-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const newNotification = payload.new as Notification
                    setNotifications((prev) => [newNotification, ...prev])
                    setUnreadCount((prev) => prev + 1)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase])

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleMarkAsRead = async (id: string) => {
        // Optimistic update
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))

        await markNotificationAsRead(id)
    }

    const handleMarkAllAsRead = async () => {
        // Optimistic update
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnreadCount(0)

        await markAllNotificationsAsRead(userId)
    }

    const handleDelete = async (id: string, isRead: boolean) => {
        // Optimistic update
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (!isRead) {
            setUnreadCount((prev) => Math.max(0, prev - 1))
        }

        await deleteNotification(id)
    }

    const handleDeleteAll = async () => {
        setConfirmClear(false)
        // Optimistic update
        setNotifications([])
        setUnreadCount(0)

        await deleteAllNotifications(userId)
    }

    const [confirmClear, setConfirmClear] = useState(false)

    const getIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-success" />
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-warning" />
            case 'info':
                return <Info className="h-5 w-5 text-info" />
            case 'system':
                return <Bell className="h-5 w-5 text-gold" />
            default:
                return <Bell className="h-5 w-5 text-ink-faint" />
        }
    }

    return (
        <div className="relative" ref={popoverRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler'}
                aria-expanded={isOpen}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-gold-ink ring-2 ring-background">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] origin-top-right rounded-2xl border border-line-strong bg-surface-1 shadow-modal"
                    >
                        <div className="flex items-center justify-between border-b border-line px-4 py-3">
                            <h3 className="text-sm font-semibold text-ink">Bildirimler</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    type="button" className="text-xs text-gold hover:underline"
                                >
                                    Tümünü okundu işaretle
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8 text-ink-faint">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-ink-faint">
                                    <Bell className="mb-2 h-8 w-8 opacity-20" />
                                    <p className="text-sm">Henüz bildirimin yok</p>
                                </div>
                            ) : (
                                <div>
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`relative flex gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2 ${!notification.is_read ? 'bg-gold/[0.03]' : ''}`}
                                        >
                                            <div className="flex-shrink-0 pt-1">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium ${!notification.is_read ? 'text-ink' : 'text-ink-muted'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <div className="flex items-center gap-1">
                                                        {!notification.is_read && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                className="flex-shrink-0 rounded-full p-1 hover:bg-gold/10"
                                                                title="Okundu işaretle"
                                                                aria-label="Okundu işaretle"
                                                            >
                                                                <div className="h-2 w-2 rounded-full bg-gold" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(notification.id, notification.is_read)}
                                                            className="flex-shrink-0 rounded-full p-1 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                                                            title="Sil"
                                                            aria-label="Bildirimi sil"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                                                    {notification.message}
                                                </p>
                                                <p className="mt-1 text-[11px] text-ink-faint">
                                                    {new Date(notification.created_at).toLocaleDateString('tr-TR', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                                {notification.link && (
                                                    <Link
                                                        href={notification.link}
                                                        onClick={() => setIsOpen(false)}
                                                        className="mt-1.5 inline-flex items-center text-xs font-medium text-gold hover:underline"
                                                    >
                                                        Detayları gör →
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="border-t border-line p-2">
                                {confirmClear ? (
                                    <div className="flex items-center justify-between gap-2 px-2 text-xs">
                                        <span className="text-ink-muted">Tüm bildirimler silinsin mi?</span>
                                        <span className="flex gap-1">
                                            <button type="button" onClick={() => setConfirmClear(false)} className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">Vazgeç</button>
                                            <button type="button" onClick={handleDeleteAll} className="rounded-lg px-2.5 py-1.5 text-danger hover:bg-danger/10">Sil</button>
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmClear(true)}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-xs text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Tümünü temizle
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
