'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Send, Users, Search, CheckCircle, AlertTriangle, Info, Bell } from 'lucide-react'
import { sendNotification, type NotificationType } from '@/app/actions/notifications'

interface User {
    id: string
    full_name: string | null
    email: string | null
    role: 'influencer' | 'brand' | null
    username: string | null
}

interface NotificationsPanelProps {
    users: User[]
}

export default function NotificationsPanel({ users }: NotificationsPanelProps) {
    const [isPending, startTransition] = useTransition()
    const [targetType, setTargetType] = useState<'all' | 'specific'>('all')
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const searchContainerRef = useRef<HTMLDivElement>(null)
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'info' as NotificationType,
        link: '',
    })
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setSearchQuery('')
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const filteredUsers = users.filter((user) => {
        if (!searchQuery) return false
        const query = searchQuery.toLowerCase()
        return (
            user.full_name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query) ||
            user.username?.toLowerCase().includes(query)
        )
    })

    const handleUserSelect = (userId: string) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev)
            if (next.has(userId)) {
                next.delete(userId)
            } else {
                next.add(userId)
            }
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus(null)

        if (targetType === 'specific' && selectedUserIds.size === 0) {
            setStatus({ type: 'error', message: 'Lütfen en az bir kullanıcı seçin.' })
            return
        }

        if (!formData.title.trim() || !formData.message.trim()) {
            setStatus({ type: 'error', message: 'Başlık ve mesaj alanları zorunludur.' })
            return
        }

        startTransition(async () => {
            const targetUserIds = targetType === 'all' ? users.map((u) => u.id) : Array.from(selectedUserIds)

            const result = await sendNotification(
                targetUserIds,
                formData.title,
                formData.message,
                formData.type,
                formData.link || undefined
            )

            if (result.success) {
                setStatus({ type: 'success', message: `Bildirim ${targetUserIds.length} kullanıcıya başarıyla gönderildi.` })
                setFormData({ title: '', message: '', type: 'info', link: '' })
                setSelectedUserIds(new Set())
                setTargetType('all')
            } else {
                setStatus({ type: 'error', message: result.error || 'Bildirim gönderilirken bir hata oluştu.' })
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#0c0d13] p-6">
                <h2 className="mb-6 text-xl font-semibold text-white flex items-center gap-2">
                    <Bell className="h-5 w-5 text-soft-gold" />
                    Yeni Bildirim Gönder
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Target Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Hedef Kitle</label>
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setTargetType('all')}
                                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${targetType === 'all'
                                    ? 'border-soft-gold bg-soft-gold/10 text-soft-gold'
                                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                <Users className="h-4 w-4" />
                                Tüm Kullanıcılar ({users.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetType('specific')}
                                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${targetType === 'specific'
                                    ? 'border-soft-gold bg-soft-gold/10 text-soft-gold'
                                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                <Search className="h-4 w-4" />
                                Belirli Kullanıcılar {selectedUserIds.size > 0 && `(${selectedUserIds.size})`}
                            </button>
                        </div>
                    </div>

                    {/* User Search (if specific) */}
                    {targetType === 'specific' && (
                        <div ref={searchContainerRef} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Kullanıcı ara (İsim, E-posta, Kullanıcı Adı)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-soft-gold/50 focus:outline-none"
                                />
                            </div>

                            {searchQuery && (
                                <div className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-black/40">
                                    {filteredUsers.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-gray-500">Kullanıcı bulunamadı</div>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => handleUserSelect(user.id)}
                                                className="flex w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 last:border-0"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium text-white">{user.full_name || user.username || 'İsimsiz'}</p>
                                                    <p className="text-xs text-gray-400">{user.email}</p>
                                                </div>
                                                {selectedUserIds.has(user.id) && (
                                                    <CheckCircle className="h-4 w-4 text-soft-gold" />
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {selectedUserIds.size > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {Array.from(selectedUserIds).map(id => {
                                        const user = users.find(u => u.id === id)
                                        if (!user) return null
                                        return (
                                            <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-soft-gold/10 px-2 py-1 text-xs text-soft-gold border border-soft-gold/20">
                                                {user.full_name || user.username}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleUserSelect(id)
                                                    }}
                                                    className="ml-1 hover:text-white"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Message Details */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-300">Bildirim Tipi</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'info', label: 'Bilgi', icon: Info },
                                    { value: 'success', label: 'Başarılı', icon: CheckCircle },
                                    { value: 'warning', label: 'Uyarı', icon: AlertTriangle },
                                    { value: 'system', label: 'Sistem', icon: Bell },
                                ].map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: type.value as NotificationType })}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${formData.type === type.value
                                            ? 'border-soft-gold bg-soft-gold/10 text-soft-gold'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <type.icon className="h-4 w-4" />
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-300">Yönlendirme Linki (Opsiyonel)</label>
                            <input
                                type="text"
                                placeholder="/dashboard/..."
                                value={formData.link}
                                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-soft-gold/50 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Başlık</label>
                        <input
                            type="text"
                            placeholder="Bildirim başlığı..."
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-soft-gold/50 focus:outline-none"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Mesaj</label>
                        <textarea
                            rows={4}
                            placeholder="Bildirim içeriği..."
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-soft-gold/50 focus:outline-none"
                        />
                    </div>

                    {status && (
                        <div className={`rounded-xl border p-4 ${status.type === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-red-500/20 bg-red-500/10 text-red-400'
                            }`}>
                            {status.message}
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 rounded-xl bg-soft-gold px-8 py-3 font-semibold text-black transition hover:bg-soft-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isPending ? (
                                'Gönderiliyor...'
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Bildirimi Gönder
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
