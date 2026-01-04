'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Info, MoreVertical, Phone, Video } from 'lucide-react'
import MessageActionsMenu from './MessageActionsMenu'
import ModernChatInput from './ModernChatInput'
import Image from 'next/image'
import { isUserBlocked } from '@/app/dashboard/users/block/actions'
import { sendMessage } from '@/app/dashboard/messages/send/actions'

export interface ChatMessage {
    id: string
    sender_id: string
    content: string
    created_at: string
}

interface ModernChatWindowProps {
    roomId: string
    currentUserId: string
    initialMessages: ChatMessage[]
    brandName?: string
    avatarUrl?: string | null
    username?: string | null
    returnUrl?: string
    otherParticipantId?: string
    activeRoomIds?: string[]
    otherParticipantVerificationStatus?: 'pending' | 'verified' | 'rejected' | null
    otherParticipantRole?: 'influencer' | 'brand' | null
    otherParticipantBadges?: string[]
    lastBlockUpdate?: number
    onOpenProfile?: () => void
}

export default function ModernChatWindow({
    roomId,
    currentUserId,
    initialMessages,
    brandName,
    avatarUrl,
    username,
    otherParticipantId,
    activeRoomIds,
    otherParticipantVerificationStatus,
    otherParticipantRole,
    otherParticipantBadges,
    lastBlockUpdate,
    onOpenProfile
}: ModernChatWindowProps) {
    const supabase = useSupabaseClient()
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [isSending, setIsSending] = useState(false)
    const [isBlocked, setIsBlocked] = useState(false)
    const [hasBlocked, setHasBlocked] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // --- LOGIC START (Copied from ChatWindow.tsx) ---

    // Update messages when initialMessages changes
    useEffect(() => {
        if (initialMessages && initialMessages.length > 0) {
            setMessages(initialMessages)
        }
    }, [initialMessages])

    // Check blocked status
    useEffect(() => {
        const checkBlocked = async () => {
            const otherId = otherParticipantId || messages.find((m) => m.sender_id !== currentUserId)?.sender_id
            if (!otherId) return

            const result = await isUserBlocked(otherId)
            setIsBlocked(result.blocked)
            setHasBlocked(result.hasBlocked ?? false)
        }

        if (otherParticipantId || messages.length > 0) {
            checkBlocked()
        }
    }, [messages, currentUserId, otherParticipantId, lastBlockUpdate])

    // Realtime subscription
    useEffect(() => {
        const roomsToSubscribe = activeRoomIds && activeRoomIds.length > 0 ? activeRoomIds : [roomId]

        const channels = roomsToSubscribe.map((rId) => {
            return supabase
                .channel(`room-${rId}`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${rId}` },
                    (payload) => {
                        const newMsg = payload.new as ChatMessage
                        setMessages((prev) => {
                            if (prev.some((m) => m.id === newMsg.id)) return prev
                            return [...prev, newMsg]
                        })
                    },
                )
                .subscribe()
        })

        return () => {
            channels.forEach((channel) => {
                supabase.removeChannel(channel)
            })
        }
    }, [roomId, supabase, activeRoomIds])

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])


    const handleSendMessage = async (content: string) => {
        if (isBlocked) {
            alert('Bu kullanıcı sizi engellemiş. Mesaj gönderemezsiniz.')
            return
        }

        if (hasBlocked) {
            alert('Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.')
            return
        }

        setIsSending(true)

        const result = await sendMessage(roomId, content)

        if (!result.success) {
            console.error('Chat send failed', result.error)
            if (result.error?.includes('engelle') || result.error?.includes('block')) {
                setIsBlocked(true)
                alert(result.error)
            } else {
                alert(result.error || 'Mesaj gönderilemedi.')
            }
        } else if (result.data) {
            const newMsg = result.data as ChatMessage
            setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev
                return [...prev, newMsg]
            })
        }
        setIsSending(false)
    }

    const handleFileUpload = async (file: File) => {
        if (isBlocked || hasBlocked) return

        setIsSending(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
            const filePath = `${roomId}/${currentUserId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath)

            const content = `![image](${publicUrl})`
            await handleSendMessage(content)
        } catch (error: any) {
            console.error('File upload error:', error)
            alert(`Dosya yüklenemedi: ${error.message || 'Bilinmeyen hata'}. Lütfen 'chat-attachments' adında bir bucket olduğundan ve public erişim izni olduğundan emin olun.`)
        } finally {
            setIsSending(false)
        }
    }

    // --- LOGIC END ---

    return (
        <div className="flex h-full flex-col bg-[#0B0C10] relative">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex h-16 items-center justify-between border-b border-white/5 bg-[#0F1014]/80 px-6 backdrop-blur-md transition-all">
                <div
                    className="flex items-center gap-4 cursor-pointer transition opacity-100 hover:opacity-80"
                    onClick={onOpenProfile}
                >
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-inner">
                        {avatarUrl ? (
                            <Image src={avatarUrl} alt={brandName || 'User'} fill className="object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-soft-gold">
                                {brandName?.[0]?.toUpperCase() ?? 'U'}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{brandName ?? 'Sohbet'}</h3>
                            {otherParticipantBadges && otherParticipantBadges.length > 0 && (
                                <BadgeCheck className={`h-4 w-4 ${otherParticipantRole === 'brand' ? 'text-soft-gold' : 'text-blue-400'}`} />
                            )}
                        </div>
                        <p className="text-xs text-gray-400">
                            {username ? `@${username}` : isBlocked ? 'Engellendi' : hasBlocked ? 'Engellediniz' : 'Çevrimdışı'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/5 hover:text-white"
                        title="Profil Detayları"
                        onClick={onOpenProfile}
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto px-4 pt-20 pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 opacity-50">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                            <Info className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-400">Sohbeti başlatmak için bir mesaj yazın.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {messages.map((message, index) => {
                            const isOwn = message.sender_id === currentUserId
                            const showAvatar = !isOwn && (index === 0 || messages[index - 1].sender_id !== message.sender_id)
                            const isImage = message.content.startsWith('![image](') && message.content.endsWith(')')
                            const imageUrl = isImage ? message.content.slice(9, -1) : null

                            return (
                                <div key={message.id} className={`group flex items-end gap-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    {/* Avatar placeholder for alignment */}
                                    {!isOwn && (
                                        <div className="w-8 flex-shrink-0">
                                            {showAvatar && (
                                                <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/5">
                                                    {avatarUrl ? (
                                                        <Image src={avatarUrl} alt={brandName || 'U'} fill className="object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-gray-400">
                                                            {brandName?.[0] ?? 'U'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex max-w-[80%] flex-col gap-1 sm:max-w-[70%]">
                                        <div className="relative group/actions">
                                            {/* Message Bubble */}
                                            <div
                                                className={`relative rounded-[20px] px-5 py-3 text-sm leading-relaxed shadow-sm transition-all ${isOwn
                                                    ? 'rounded-tr-sm bg-gradient-to-br from-soft-gold via-soft-gold/90 to-yellow-600 text-[#0B0C10] shadow-[0_4px_15px_-5px_rgba(212,175,55,0.3)]'
                                                    : 'rounded-tl-sm border border-white/10 bg-[#1A1B23] text-gray-100'
                                                    } ${isImage ? 'p-1' : ''}`}
                                            >
                                                {isImage && imageUrl ? (
                                                    <a
                                                        href={imageUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="relative aspect-[4/3] w-full min-w-[200px] block cursor-pointer overflow-hidden rounded-xl bg-black/20 transition hover:opacity-90"
                                                    >
                                                        <Image
                                                            src={imageUrl}
                                                            alt="Fotoğraf"
                                                            className="object-cover"
                                                            fill
                                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                        />
                                                    </a>
                                                ) : (
                                                    message.content
                                                )}
                                            </div>

                                            {/* Actions Menu Trigger (Hidden by default, shown on hover) */}
                                            {!isOwn && (
                                                <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/actions:opacity-100">
                                                    <MessageActionsMenu
                                                        messageId={message.id}
                                                        senderId={message.sender_id}
                                                        roomId={roomId}
                                                        currentUserId={currentUserId}
                                                        onBlocked={() => {
                                                            setIsBlocked(false)
                                                            setHasBlocked(true)
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Timestamp */}
                                        <span className={`text-[10px] text-gray-500 ${isOwn ? 'text-right' : 'text-left'} opacity-0 transition-opacity group-hover:opacity-100`}>
                                            {new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="relative z-10 border-t border-white/5 bg-[#0F1014] p-4">
                {(isBlocked || hasBlocked) && (
                    <div className="mb-4 flex items-center justify-center rounded-xl bg-red-500/10 py-2 text-xs font-medium text-red-400 border border-red-500/20">
                        {isBlocked ? 'Bu kullanıcı sizi engellemiş.' : 'Bu kullanıcıyı engellediniz.'}
                    </div>
                )}
                <ModernChatInput
                    onSend={handleSendMessage}
                    onFileSelect={handleFileUpload}
                    disabled={isSending || isBlocked || hasBlocked}
                    placeholder={isBlocked || hasBlocked ? 'Mesajlaşma devre dışı' : `${brandName?.split(' ')[0] || 'Kullanıcı'} ile sohbet et...`}
                />
            </div>
        </div>
    )
}
