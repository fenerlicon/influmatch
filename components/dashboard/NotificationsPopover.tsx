'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, Info, AlertTriangle, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react'
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, deleteAllNotifications } from '@/app/actions/notifications'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    const router = useRouter()

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
        if (!confirm('Tüm bildirimleri silmek istediğinizden emin misiniz?')) return

        // Optimistic update
        setNotifications([])
        setUnreadCount(0)

        await deleteAllNotifications(userId)
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-emerald-400" />
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-yellow-400" />
            case 'info':
                return <Info className="h-5 w-5 text-blue-400" />
            case 'system':
                return <Bell className="h-5 w-5 text-soft-gold" />
            default:
                return <Bell className="h-5 w-5 text-gray-400" />
        }
    }

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative rounded-full border border-white/10 bg-white/5 p-2.5 text-gray-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-soft-gold/20"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-[#101117]">
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
                        className="absolute right-0 top-full mt-4 w-80 sm:w-96 z-50 origin-top-right rounded-2xl border border-white/10 bg-[#1A1B23] shadow-2xl ring-1 ring-black/5 backdrop-blur-xl"
                    >
                        <div className="flex items-center justify-between border-b border-white/5 p-4">
                            <h3 className="text-sm font-semibold text-white">Bildirimler</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs text-soft-gold hover:text-soft-gold/80 hover:underline"
                                >
                                    Tümünü okundu işaretle
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto py-2">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8 text-gray-400">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                                    <Bell className="mb-2 h-8 w-8 opacity-20" />
                                    <p className="text-sm">Henüz bildiriminiz yok</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`relative flex gap-4 px-4 py-3 transition hover:bg-white/5 ${!notification.is_read ? 'bg-white/[0.02]' : ''
                                                }`}
                                        >
                                            <div className="flex-shrink-0 pt-1">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium ${!notification.is_read ? 'text-white' : 'text-gray-300'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <div className="flex items-center gap-1">
                                                        {!notification.is_read && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                className="flex-shrink-0 rounded-full p-1 text-soft-gold hover:bg-soft-gold/10"
                                                                title="Okundu işaretle"
                                                            >
                                                                <div className="h-2 w-2 rounded-full bg-soft-gold" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(notification.id, notification.is_read)}
                                                            className="flex-shrink-0 rounded-full p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                            title="Sil"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="mt-1.5 text-[10px] text-gray-500">
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
                                                        className="mt-2 inline-flex items-center text-xs font-medium text-soft-gold hover:underline"
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
                            <div className="border-t border-white/5 p-2">
                                <button
                                    onClick={handleDeleteAll}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl p-2 text-xs text-gray-400 transition hover:bg-white/5 hover:text-white"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Tümünü Temizle
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
