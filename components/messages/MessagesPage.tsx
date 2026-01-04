'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { X, BadgeCheck } from 'lucide-react'
import { toast } from 'sonner'
import ChatWindow from '@/components/chat/ChatWindow'
import ModernChatWindow from '@/components/chat/ModernChatWindow'
import { influencerBadges, brandBadges } from '@/app/badges/data'
import BadgeCompactList from '@/components/badges/BadgeCompactList'
import { getCategoryLabel } from '@/utils/categories'

interface Conversation {
  roomId: string
  otherParticipant: {
    id: string
    fullName: string
    username: string | null
    avatarUrl: string | null
    role: 'influencer' | 'brand' | null
    verificationStatus?: 'pending' | 'verified' | 'rejected'
    displayedBadges?: string[]
  } | null
  lastMessage: {
    content: string
    createdAt: string
    senderId: string
  } | null
  unreadCount: number
}

interface MessagesPageProps {
  currentUserId: string
  role: 'influencer' | 'brand'
  initialConversations: Conversation[]
  initialUserId?: string // User ID to open conversation with
}

export default function MessagesPage({ currentUserId, role, initialConversations, initialUserId }: MessagesPageProps) {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedRoomMessages, setSelectedRoomMessages] = useState<any[]>([])
  const [otherParticipant, setOtherParticipant] = useState<Conversation['otherParticipant'] | null>(null)
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null)
  const [activeRoomIds, setActiveRoomIds] = useState<string[]>([]) // All room IDs for the selected participant
  const [primaryRoomId, setPrimaryRoomId] = useState<string | null>(null) // Room ID to use for sending messages
  const [roomParticipantMap, setRoomParticipantMap] = useState<Map<string, string>>(new Map()) // roomId -> otherParticipantId
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<{
    fullName: string
    username: string | null
    avatarUrl: string | null
    bio: string | null
    city: string | null
    category: string | null
    role: 'influencer' | 'brand' | null
    socialLinks: Record<string, string | null>
    badgeIds?: string[]
    verificationStatus?: 'pending' | 'verified' | 'rejected'
    isBlocked?: boolean
  } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [lastBlockUpdate, setLastBlockUpdate] = useState(0)

  // Load all rooms and build participant map on mount
  useEffect(() => {
    const loadAllRooms = async () => {
      const { data: allRooms } = await supabase
        .from('rooms')
        .select('id, brand_id, influencer_id')
        .or(`brand_id.eq.${currentUserId},influencer_id.eq.${currentUserId}`)

      if (!allRooms) return

      const newMap = new Map<string, string>()
      for (const room of allRooms) {
        const roomOtherId = room.brand_id === currentUserId ? room.influencer_id : room.brand_id
        // Filter out self - don't include rooms where the other participant is yourself
        if (roomOtherId && roomOtherId !== currentUserId) {
          newMap.set(room.id, roomOtherId)
        }
      }
      setRoomParticipantMap(newMap)
    }

    loadAllRooms()
  }, [supabase, currentUserId])

  // Handle initialUserId - open conversation with specific user
  useEffect(() => {
    if (!initialUserId) return

    // Don't allow opening conversation with yourself
    if (initialUserId === currentUserId) return

    const openConversationWithUser = async () => {
      // First, check if there's already a conversation with this user
      const existingConversation = conversations.find(
        (conv) => conv.otherParticipant?.id === initialUserId
      )

      if (existingConversation) {
        // Open existing conversation
        setSelectedRoomId(existingConversation.roomId)
        return
      }

      // No existing conversation - find or create a room
      const { data: existingRooms } = await supabase
        .from('rooms')
        .select('id, brand_id, influencer_id')
        .or(`and(brand_id.eq.${currentUserId},influencer_id.eq.${initialUserId}),and(brand_id.eq.${initialUserId},influencer_id.eq.${currentUserId})`)
        .limit(1)

      if (existingRooms && existingRooms.length > 0) {
        // Room exists, use it
        const room = existingRooms[0]
        setSelectedRoomId(room.id)

        // Get user info and add to conversations
        const { data: userInfo } = await supabase
          .from('users')
          .select('id, full_name, username, avatar_url, role, displayed_badges')
          .eq('id', initialUserId)
          .single()

        if (userInfo) {
          const newConversation: Conversation = {
            roomId: room.id,
            otherParticipant: {
              id: userInfo.id,
              fullName: userInfo.full_name ?? userInfo.username ?? 'Kullanıcı',
              username: userInfo.username,
              avatarUrl: userInfo.avatar_url,
              role: userInfo.role,
              displayedBadges: userInfo.displayed_badges,
            },
            lastMessage: null,
            unreadCount: 0,
          }
          setConversations((prev) => [newConversation, ...prev])
        }
      } else {
        // No room exists - create one
        const { data: newRoom, error } = await supabase
          .from('rooms')
          .insert({
            brand_id: role === 'brand' ? currentUserId : initialUserId,
            influencer_id: role === 'influencer' ? currentUserId : initialUserId,
          })
          .select()
          .single()

        if (error || !newRoom) {
          console.error('Failed to create room:', error)
          return
        }

        setSelectedRoomId(newRoom.id)

        // Get user info and add to conversations
        const { data: userInfo } = await supabase
          .from('users')
          .select('id, full_name, username, avatar_url, role, displayed_badges')
          .eq('id', initialUserId)
          .single()

        if (userInfo) {
          const newConversation: Conversation = {
            roomId: newRoom.id,
            otherParticipant: {
              id: userInfo.id,
              fullName: userInfo.full_name ?? userInfo.username ?? 'Kullanıcı',
              username: userInfo.username,
              avatarUrl: userInfo.avatar_url,
              role: userInfo.role,
              displayedBadges: userInfo.displayed_badges,
            },
            lastMessage: null,
            unreadCount: 0,
          }
          setConversations((prev) => [newConversation, ...prev])
        }
      }
    }

    openConversationWithUser()
  }, [initialUserId, conversations, supabase, currentUserId, role])

  // Load messages for selected conversation (all rooms with same participant)
  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedRoomMessages([])
      setOtherParticipant(null)
      setOtherParticipantId(null)
      setActiveRoomIds([])
      setPrimaryRoomId(null)
      return
    }

    const loadMessages = async () => {
      // Clear previous messages first
      setSelectedRoomMessages([])
      // First, get the selected conversation to find the other participant
      const conversation = conversations.find((c) => c.roomId === selectedRoomId)
      if (!conversation?.otherParticipant) return

      const otherParticipantId = conversation.otherParticipant.id
      setOtherParticipantId(otherParticipantId)
      setOtherParticipant(conversation.otherParticipant)

      // Find all rooms with this participant
      const { data: allRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, brand_id, influencer_id, created_at')
        .or(`brand_id.eq.${currentUserId},influencer_id.eq.${currentUserId}`)

      if (roomsError) {
        console.error('Failed to load rooms:', roomsError)
        return
      }

      // Filter rooms that involve the other participant
      const relevantRooms: Array<{ id: string; created_at: string }> = []
      const newRoomParticipantMap = new Map<string, string>()

      for (const room of allRooms ?? []) {
        const roomOtherId = room.brand_id === currentUserId ? room.influencer_id : room.brand_id
        // Filter out self - don't include rooms where the other participant is yourself
        if (roomOtherId && roomOtherId !== currentUserId) {
          newRoomParticipantMap.set(room.id, roomOtherId)
        }
        if (roomOtherId === otherParticipantId && roomOtherId !== currentUserId) {
          relevantRooms.push({ id: room.id, created_at: room.created_at })
        }
      }

      setRoomParticipantMap(newRoomParticipantMap)

      if (relevantRooms.length === 0) return

      const relevantRoomIds = relevantRooms.map((r) => r.id)
      setActiveRoomIds(relevantRoomIds)

      // Find the room with the most recent message (or oldest room if no messages)
      const { data: allMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, room_id')
        .in('room_id', relevantRoomIds)
        .order('created_at', { ascending: true })

      if (messagesError) {
        console.error('Failed to load messages:', messagesError)
        return
      }

      // Find the room with the most recent message (for sending new messages)
      let primaryRoomId = relevantRoomIds[0] // Default to first room
      if (allMessages && allMessages.length > 0) {
        // Get the most recent message's room
        const mostRecentMessage = allMessages[allMessages.length - 1]
        primaryRoomId = mostRecentMessage.room_id
      } else {
        // If no messages, use the oldest room
        const sortedRooms = [...relevantRooms].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        primaryRoomId = sortedRooms[0]?.id ?? relevantRoomIds[0]
      }

      // Store primary room ID for sending messages
      setPrimaryRoomId(primaryRoomId)

      setSelectedRoomMessages((allMessages ?? []).map((msg) => ({
        id: msg.id,
        sender_id: msg.sender_id,
        content: msg.content,
        created_at: msg.created_at,
      })))
    }

    loadMessages()
  }, [selectedRoomId, supabase, currentUserId, conversations])

  // Real-time updates for conversations
  useEffect(() => {
    const channel = supabase
      .channel('messages-updates-all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as any

          // Get participant ID for this room from map
          const messageParticipantId = roomParticipantMap.get(newMessage.room_id)
          if (!messageParticipantId) {
            // Room not in map yet - might be a new room, skip for now
            // (it will be added when user selects the conversation)
            return
          }

          // Find conversation with this participant
          const conversation = conversations.find((conv) =>
            conv.otherParticipant?.id === messageParticipantId
          )

          if (!conversation) return

          // Update conversation list
          setConversations((prev) =>
            prev.map((conv) => {
              if (conv.otherParticipant?.id === messageParticipantId) {
                return {
                  ...conv,
                  lastMessage: {
                    content: newMessage.content,
                    createdAt: newMessage.created_at,
                    senderId: newMessage.sender_id,
                  },
                  unreadCount:
                    newMessage.sender_id !== currentUserId &&
                      (!selectedRoomId || !activeRoomIds.includes(newMessage.room_id))
                      ? (conv.unreadCount ?? 0) + 1
                      : conv.unreadCount,
                }
              }
              return conv
            }),
          )

          // If this message is from a room with the selected participant, add to chat
          if (selectedRoomId && otherParticipantId === messageParticipantId && activeRoomIds.includes(newMessage.room_id)) {
            setSelectedRoomMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMessage.id)) return prev
              return [...prev, {
                id: newMessage.id,
                sender_id: newMessage.sender_id,
                content: newMessage.content,
                created_at: newMessage.created_at,
              }]
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversations, currentUserId, selectedRoomId, activeRoomIds, otherParticipantId, roomParticipantMap])

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Şimdi'
      if (diffMins < 60) return `${diffMins}dk önce`
      if (diffHours < 24) return `${diffHours}s önce`
      if (diffDays < 7) return `${diffDays}g önce`

      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
      })
    } catch {
      return dateString
    }
  }

  const handleSelectConversation = async (roomId: string) => {
    setSelectedRoomId(roomId)

    // Mark all messages in this room as read by updating user metadata
    const now = new Date().toISOString()

    // Update local conversation list immediately
    setConversations((prev) =>
      prev.map((conv) => (conv.roomId === roomId ? { ...conv, unreadCount: 0 } : conv)),
    )

    // Persist to database (User Metadata)
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        [`last_read_${roomId}`]: now
      }
    })

    if (updateError) {
      console.error('Failed to update read status:', updateError)
    }
  }

  const handleOpenProfile = useCallback(
    async (userId: string, event: React.MouseEvent) => {
      event.stopPropagation()
      setProfileModalUserId(userId)
      setProfileModalOpen(true)
      setProfileLoading(true)

      try {
        const [{ data, error }, { data: userBadges }, { data: blockCheck }] = await Promise.all([
          supabase
            .from('users')
            .select('full_name, username, avatar_url, bio, city, category, role, social_links, verification_status')
            .eq('id', userId)
            .single(),
          supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', userId),
          supabase
            .from('user_blocks')
            .select('id')
            .eq('blocker_user_id', currentUserId)
            .eq('blocked_user_id', userId)
            .maybeSingle(),
        ])

        if (error) {
          console.error('Failed to load profile:', error)
          setProfileData(null)
        } else {
          const badgeIds = userBadges?.map((ub) => ub.badge_id) ?? []
          setProfileData({
            fullName: data.full_name ?? 'Kullanıcı',
            username: data.username,
            avatarUrl: data.avatar_url,
            bio: data.bio,
            city: data.city,
            category: data.category,
            role: data.role,
            socialLinks: (data.social_links as Record<string, string | null>) ?? {},
            badgeIds,
            verificationStatus: data.verification_status as 'pending' | 'verified' | 'rejected' | undefined,
            isBlocked: !!blockCheck,
          })
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        setProfileData(null)
      } finally {
        setProfileLoading(false)
      }
    },
    [supabase, currentUserId],
  )

  const handleCloseProfile = useCallback(() => {
    setProfileModalOpen(false)
    setProfileModalUserId(null)
    setProfileData(null)
  }, [])

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-3xl border border-white/10 bg-[#0B0C10] overflow-hidden">
      {/* Left Sidebar - Conversations List */}
      <div className={`${selectedRoomId ? 'hidden sm:flex' : 'flex'} w-full sm:w-80 lg:w-96 border-r border-white/10 bg-[#0F1014] flex-col`}>
        <div className="p-4 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Mesajlar</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-sm text-gray-400 text-center">Henüz mesajınız yok.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {conversations.map((conversation) => {
                if (!conversation.otherParticipant) return null

                const isSelected = selectedRoomId === conversation.roomId
                const isUnread = conversation.unreadCount > 0

                return (
                  <button
                    key={conversation.roomId}
                    type="button"
                    onClick={() => handleSelectConversation(conversation.roomId)}
                    className={`w-full p-4 text-left transition hover:bg-white/5 ${isSelected ? 'bg-white/10 border-l-2 border-soft-gold' : ''
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        onClick={(e) => handleOpenProfile(conversation.otherParticipant!.id, e)}
                        className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 cursor-pointer hover:border-soft-gold/50 transition"
                      >
                        {conversation.otherParticipant.avatarUrl ? (
                          <Image
                            src={conversation.otherParticipant.avatarUrl}
                            alt={conversation.otherParticipant.fullName}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-soft-gold">
                            {conversation.otherParticipant.fullName[0]?.toUpperCase() ?? 'U'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              onClick={(e) => handleOpenProfile(conversation.otherParticipant!.id, e)}
                              className={`text-sm font-semibold truncate hover:text-soft-gold transition cursor-pointer ${isUnread ? 'text-white' : 'text-gray-300'
                                }`}
                            >
                              {conversation.otherParticipant.fullName}
                            </div>
                            {conversation.otherParticipant.displayedBadges?.includes(conversation.otherParticipant.role === 'brand' ? 'official-business' : 'verified-account') && (
                              <div className="group relative flex-shrink-0">
                                <BadgeCheck className={`h-4 w-4 ${conversation.otherParticipant.role === 'brand' ? 'text-soft-gold' : 'text-blue-400'}`} />
                                <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-xs text-white group-hover:block">
                                  {conversation.otherParticipant.role === 'brand' ? 'Onaylı İşletme' : 'Onaylı Hesap'}
                                </div>
                              </div>
                            )}
                          </div>
                          {conversation.lastMessage && (
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {formatTime(conversation.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-xs truncate ${isUnread ? 'text-white font-medium' : 'text-gray-400'
                              }`}
                          >
                            {conversation.lastMessage
                              ? conversation.lastMessage.senderId === currentUserId
                                ? `Siz: ${conversation.lastMessage.content.startsWith('![image](') ? '📷 Fotoğraf' : conversation.lastMessage.content}`
                                : conversation.lastMessage.content.startsWith('![image](') ? '📷 Fotoğraf' : conversation.lastMessage.content
                              : 'İçerik yok'}
                          </p>
                          {isUnread && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white flex-shrink-0">
                              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedRoomId && otherParticipant ? (
          <>
            {/* Mobile back button */}
            <div className="sm:hidden p-4 border-b border-white/10">
              <button
                type="button"
                onClick={() => setSelectedRoomId(null)}
                className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white"
              >
                ← Geri
              </button>
            </div>
            <ModernChatWindow
              roomId={primaryRoomId || selectedRoomId}
              currentUserId={currentUserId}
              initialMessages={selectedRoomMessages}
              brandName={otherParticipant.fullName}
              avatarUrl={otherParticipant.avatarUrl}
              username={otherParticipant.username}
              returnUrl="/dashboard/messages"
              otherParticipantId={otherParticipantId ?? undefined}
              activeRoomIds={activeRoomIds}
              otherParticipantVerificationStatus={otherParticipant.verificationStatus}
              otherParticipantRole={otherParticipant.role}
              otherParticipantBadges={otherParticipant.displayedBadges}
              lastBlockUpdate={lastBlockUpdate}
              onOpenProfile={() => otherParticipant && handleOpenProfile(otherParticipant.id, { stopPropagation: () => { } } as any)}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6 bg-[#0B0C10]">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-soft-gold/20 to-soft-gold/5 border border-soft-gold/20 shadow-[0_0_30px_-10px_rgba(212,175,55,0.2)]">
                <BadgeCheck className="h-8 w-8 text-soft-gold" />
              </div>
              <h3 className="text-xl font-bold text-white">Sohbet Başlatın</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Mesajlaşmaya başlamak için sol taraftaki listeden bir kişi seçin.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={handleCloseProfile}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0F1014] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseProfile}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 backdrop-blur-sm text-gray-400 transition hover:border-white/50 hover:bg-black/80 hover:text-white"
              aria-label="Kapat"
            >
              <X className="h-5 w-5" />
            </button>

            {profileLoading ? (
              <div className="flex min-h-[400px] items-center justify-center p-8">
                <p className="text-gray-400">Profil yükleniyor...</p>
              </div>
            ) : profileData ? (
              <div className="p-8">
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                    {profileData.avatarUrl ? (
                      <Image
                        src={profileData.avatarUrl}
                        alt={profileData.fullName}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-soft-gold">
                        {profileData.fullName[0]?.toUpperCase() ?? 'U'}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="text-2xl font-semibold text-white">{profileData.fullName}</h2>
                      {profileData.badgeIds?.includes(profileData.role === 'brand' ? 'official-business' : 'verified-account') && (
                        <div className="group/verify relative flex-shrink-0">
                          <BadgeCheck className={`h-6 w-6 transition-all hover:scale-110 cursor-pointer ${profileData.role === 'brand' ? 'text-soft-gold hover:text-soft-gold/80' : 'text-blue-500 hover:text-blue-400'}`} />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover/verify:opacity-100 group-hover/verify:visible transition-all duration-200 z-50 pointer-events-none">
                            <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg border border-white/10">
                              {profileData.role === 'brand' ? 'Onaylı İşletme' : 'Onaylı Hesap'}
                              <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-px">
                                <div className="h-2 w-2 rotate-45 border-r border-b border-white/10 bg-gray-900"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {profileData.username && (
                      <p className="mt-1 text-sm text-gray-400">@{profileData.username}</p>
                    )}
                    <div className="mt-2 flex items-center justify-center gap-2">
                      {profileData.role && (
                        <span className="inline-block rounded-full border border-soft-gold/60 bg-soft-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-soft-gold">
                          {profileData.role === 'influencer' ? 'Influencer' : 'Marka'}
                        </span>
                      )}
                      {profileData.isBlocked ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!profileModalUserId) return

                            // Optimistic update
                            setProfileData((prev) => prev ? { ...prev, isBlocked: false } : null)

                            const { unblockUser } = await import('@/app/dashboard/users/block/actions')
                            const result = await unblockUser(profileModalUserId)

                            if (!result.success) {
                              setProfileData((prev) => prev ? { ...prev, isBlocked: true } : null)
                              toast.error(result.error || 'İşlem başarısız.')
                            } else {
                              toast.success('Engel kaldırıldı.')
                              setLastBlockUpdate(Date.now())
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 transition hover:border-emerald-400 hover:bg-emerald-500/20"
                        >
                          Engeli Kaldır
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!profileModalUserId) return
                            if (!confirm('Bu kullanıcıyı engellemek istediğinizden emin misiniz?')) return

                            // Optimistic update
                            setProfileData((prev) => prev ? { ...prev, isBlocked: true } : null)

                            const { blockUser } = await import('@/app/dashboard/users/block/actions')
                            const result = await blockUser(profileModalUserId)

                            if (!result.success) {
                              setProfileData((prev) => prev ? { ...prev, isBlocked: false } : null)
                              toast.error(result.error || 'İşlem başarısız.')
                            } else {
                              toast.success('Kullanıcı engellendi.')
                              setLastBlockUpdate(Date.now())
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400 transition hover:border-red-400 hover:bg-red-500/20"
                        >
                          Engelle
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {(profileData.city || profileData.category) && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {profileData.city && (
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Şehir</p>
                            <p className="mt-2 text-base text-white">{profileData.city}</p>
                          </div>
                        )}
                        {profileData.category && (
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Kategori</p>
                            <p className="mt-2 text-base text-white">{getCategoryLabel(profileData.category)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {profileData.bio && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Hakkında</p>
                      <p className="mt-3 text-base text-gray-200 whitespace-pre-line">{profileData.bio}</p>
                    </div>
                  )}

                  {Object.entries(profileData.socialLinks).some(([, value]) => Boolean(value)) && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-soft-gold">Sosyal Medya</p>
                      <div className="mt-3 space-y-2">
                        {Object.entries(profileData.socialLinks)
                          .filter(([, value]) => Boolean(value))
                          .map(([key, url]) => (
                            <a
                              key={key}
                              href={url!}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-200 transition hover:border-soft-gold/50 hover:text-soft-gold"
                            >
                              <span className="font-semibold capitalize">{key}</span>
                              <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Ziyaret Et</span>
                            </a>
                          ))}
                      </div>
                    </div>
                  )}

                  {profileData.badgeIds && profileData.badgeIds.length > 0 && profileData.role && (
                    <BadgeCompactList
                      badges={
                        (profileData.role === 'influencer' ? influencerBadges : brandBadges).filter((badge) =>
                          profileData.badgeIds!.includes(badge.id),
                        )
                      }
                      userRole={profileData.role}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[400px] items-center justify-center p-8">
                <p className="text-gray-400">Profil yüklenemedi.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
