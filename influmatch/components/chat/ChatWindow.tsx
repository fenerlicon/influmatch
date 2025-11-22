'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import MessageActionsMenu from './MessageActionsMenu'
import { isUserBlocked } from '@/app/dashboard/users/block/actions'
import { checkIfBlocked } from '@/app/dashboard/messages/actions'
import { sendMessage } from '@/app/dashboard/messages/send/actions'

export interface ChatMessage {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface ChatWindowProps {
  roomId: string
  currentUserId: string
  initialMessages: ChatMessage[]
  brandName?: string
  returnUrl?: string
  otherParticipantId?: string
  activeRoomIds?: string[] // For messages page: all room IDs with the same participant
}

export default function ChatWindow({ roomId, currentUserId, initialMessages, brandName, returnUrl, otherParticipantId, activeRoomIds }: ChatWindowProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [hasBlocked, setHasBlocked] = useState(false) // Track if current user blocked the other
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Update messages when initialMessages changes (for messages page)
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages)
    }
  }, [initialMessages])

  // Check if user is blocked
  useEffect(() => {
    const checkBlocked = async () => {
      // Use provided otherParticipantId or find from messages
      const otherId = otherParticipantId || messages.find((m) => m.sender_id !== currentUserId)?.sender_id
      if (!otherId) return

      const result = await isUserBlocked(otherId)
      setIsBlocked(result.blocked)
      setHasBlocked(result.hasBlocked ?? false)
    }

    if (otherParticipantId || messages.length > 0) {
      checkBlocked()
    }
  }, [messages, currentUserId, otherParticipantId])

  useEffect(() => {
    // If activeRoomIds is provided (messages page), subscribe to all those rooms
    // Otherwise, subscribe to just the single roomId
    const roomsToSubscribe = activeRoomIds && activeRoomIds.length > 0 ? activeRoomIds : [roomId]
    
    const channels = roomsToSubscribe.map((rId) => {
      return supabase
        .channel(`room-${rId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${rId}` },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as ChatMessage])
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when chat window is open
  useEffect(() => {
    if (!roomId || !currentUserId || messages.length === 0) return

    // Debounce to avoid too many calls
    const timeoutId = setTimeout(async () => {
      // Get all unread messages from the other party
      const otherPartyMessages = messages.filter((m) => m.sender_id !== currentUserId)
      if (otherPartyMessages.length === 0) return

      // Get existing read receipts
      const messageIds = otherPartyMessages.map((m) => m.id)
      const { data: existingReads } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('user_id', currentUserId)

      const readMessageIds = new Set(existingReads?.map((r) => r.message_id) ?? [])

      // Insert read receipts for unread messages
      const unreadMessageIds = messageIds.filter((id) => !readMessageIds.has(id))
      if (unreadMessageIds.length > 0) {
        const readReceipts = unreadMessageIds.map((messageId) => ({
          message_id: messageId,
          user_id: currentUserId,
        }))

        await supabase.from('message_reads').upsert(readReceipts, { onConflict: 'message_id,user_id' })
      }
    }, 500) // Wait 500ms after messages change to mark as read

    return () => clearTimeout(timeoutId)
  }, [roomId, currentUserId, messages, supabase])

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content) return
    
    if (isBlocked) {
      alert('Bu kullanıcı sizi engellemiş. Mesaj gönderemezsiniz.')
      return
    }

    if (hasBlocked) {
      alert('Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.')
      return
    }

    setIsSending(true)
    setInputValue('')
    
    // Use server action to send message (includes blocking check)
    const result = await sendMessage(roomId, content)
    
    if (!result.success) {
      console.error('Chat send failed', result.error)
      setInputValue(content)
      
      // Check if error is due to blocking
      if (result.error?.includes('engelle') || result.error?.includes('block')) {
        setIsBlocked(true)
        alert(result.error)
      } else {
        alert(result.error || 'Mesaj gönderilemedi.')
      }
    } else if (result.data) {
      // Message sent successfully, add it to local state
      setMessages((prev) => [...prev, result.data as ChatMessage])
    }
    setIsSending(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const isMessagesPage = returnUrl === '/dashboard/messages'

  return (
    <div className="flex h-full flex-col bg-transparent text-white">
      {!isMessagesPage && (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (returnUrl) {
                router.push(returnUrl)
              } else {
                router.back()
              }
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-soft-gold hover:text-soft-gold"
          >
            ← Geri
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Marka</p>
            <p className="mt-1 text-lg font-semibold text-white">{brandName ?? 'Sohbet'}</p>
          </div>
          <div className="hidden w-[96px] sm:block" />
        </div>
      )}
      {isMessagesPage && (
        <div className="mb-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-lg font-semibold text-white">{brandName ?? 'Sohbet'}</p>
              {otherParticipantId && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {otherParticipantId === currentUserId ? 'Sen' : 'Diğer kullanıcı'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 space-y-4 overflow-y-auto ${isMessagesPage ? 'p-4' : 'rounded-2xl border border-white/5 bg-white/5 p-6'}`}>
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Henüz mesaj yok.</p>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === currentUserId
            return (
              <div key={message.id} className={`flex items-start gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                {!isOwn && (
                  <div className="relative">
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
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                    isOwn
                      ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_15px_rgba(212,175,55,0.35)]'
                      : 'bg-white/10 text-gray-100'
                  }`}
                >
                  <p>{message.content}</p>
                  <span className="mt-1 block text-xs text-gray-400">
                    {new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex gap-3">
        {isBlocked && (
          <div className="mb-2 w-full rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">
            Bu kullanıcı tarafından engellendiniz. Mesaj gönderemezsiniz.
          </div>
        )}
        {hasBlocked && !isBlocked && (
          <div className="mb-2 w-full rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">
            Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.
          </div>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isBlocked || hasBlocked ? 'Mesaj gönderilemez...' : 'Mesaj yaz...'}
          disabled={isBlocked || hasBlocked}
          className="flex-1 rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 text-sm outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || isBlocked || hasBlocked}
          className="rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-5 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Gönder
        </button>
      </div>
    </div>
  )
}

