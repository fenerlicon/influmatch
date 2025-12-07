import { redirect } from 'next/navigation'
import MessagesPage from '@/components/messages/MessagesPage'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const revalidate = 0

export default async function DashboardMessagesPage({
  searchParams,
}: {
  searchParams: { userId?: string }
}) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (userProfile?.role ?? 'influencer') as 'influencer' | 'brand'

  // Get all rooms for this user
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, brand_id, influencer_id, created_at')
    .or(`brand_id.eq.${user.id},influencer_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (roomsError) {
    console.error('[DashboardMessagesPage] rooms error', roomsError.message)
  }

  // Get participant details for each room
  const participantIds = new Set<string>()
  rooms?.forEach((room) => {
    if (room.brand_id) participantIds.add(room.brand_id)
    if (room.influencer_id) participantIds.add(room.influencer_id)
  })

  const { data: participants, error: participantsError } = await supabase
    .from('users')
    .select('id, full_name, username, avatar_url, role, verification_status, displayed_badges')
    .in('id', Array.from(participantIds))

  if (participantsError) {
    console.error('[DashboardMessagesPage] participants error', participantsError.message)
  }

  // Get last message for each room
  const roomIds = rooms?.map((r) => r.id) ?? []
  let lastMessages: any[] = []
  if (roomIds.length > 0) {
    const { data, error: lastMessagesError } = await supabase
      .from('messages')
      .select('id, room_id, sender_id, content, created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })

    if (lastMessagesError) {
      console.error('[DashboardMessagesPage] lastMessages error', lastMessagesError.message)
    } else {
      lastMessages = data ?? []
    }
  }

  // Group last messages by room_id
  const lastMessageMap = new Map<string, typeof lastMessages[0]>()
  lastMessages?.forEach((msg) => {
    if (!lastMessageMap.has(msg.room_id)) {
      lastMessageMap.set(msg.room_id, msg)
    }
  })

  // Get unread message counts
  const { data: messageReads, error: readsError } = await supabase
    .from('message_reads')
    .select('message_id')
    .eq('user_id', user.id)

  if (readsError) {
    console.error('[DashboardMessagesPage] messageReads error', readsError.message)
  }

  const readMessageIds = new Set(messageReads?.map((mr) => mr.message_id) ?? [])

  // Calculate unread counts per room
  let allMessages: any[] = []
  if (roomIds.length > 0) {
    const { data, error: allMessagesError } = await supabase
      .from('messages')
      .select('id, room_id, sender_id')
      .in('room_id', roomIds)

    if (allMessagesError) {
      console.error('[DashboardMessagesPage] allMessages error', allMessagesError.message)
    } else {
      allMessages = data ?? []
    }
  }

  const unreadCounts = new Map<string, number>()
  allMessages?.forEach((msg) => {
    if (msg.sender_id !== user.id && !readMessageIds.has(msg.id)) {
      const current = unreadCounts.get(msg.room_id) ?? 0
      unreadCounts.set(msg.room_id, current + 1)
    }
  })

  // Build conversations list - group by participant to avoid duplicates
  const conversationsMap = new Map<string, {
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
    lastMessageTime: Date
  }>()

  rooms?.forEach((room) => {
    const otherParticipantId = room.brand_id === user.id ? room.influencer_id : room.brand_id
    if (!otherParticipantId) return

    // Filter out self - don't show conversations with yourself
    if (otherParticipantId === user.id) return

    const otherParticipant = participants?.find((p) => p.id === otherParticipantId)
    const lastMessage = lastMessageMap.get(room.id)
    const unreadCount = unreadCounts.get(room.id) ?? 0
    const lastMessageTime = lastMessage ? new Date(lastMessage.created_at) : new Date(room.created_at)

    const existing = conversationsMap.get(otherParticipantId)

    // If this conversation has a more recent message, or doesn't exist, add/update it
    if (!existing || (lastMessageTime > existing.lastMessageTime)) {
      conversationsMap.set(otherParticipantId, {
        roomId: room.id,
        otherParticipant: otherParticipant
          ? {
            id: otherParticipant.id,
            fullName: otherParticipant.full_name ?? otherParticipant.username ?? 'Kullanıcı',
            username: otherParticipant.username,
            avatarUrl: otherParticipant.avatar_url,
            role: otherParticipant.role,
            verificationStatus: (otherParticipant.verification_status as 'pending' | 'verified' | 'rejected' | null) ?? undefined,
            displayedBadges: otherParticipant.displayed_badges as string[] | undefined,
          }
          : null,
        lastMessage: lastMessage
          ? {
            content: lastMessage.content,
            createdAt: lastMessage.created_at,
            senderId: lastMessage.sender_id,
          }
          : null,
        unreadCount: existing ? existing.unreadCount + unreadCount : unreadCount,
        lastMessageTime,
      })
    } else {
      // Merge unread counts
      existing.unreadCount += unreadCount
    }
  })

  // Convert map to array and sort by last message time
  const conversations = Array.from(conversationsMap.values())
    .map(({ lastMessageTime, ...rest }) => rest)
    .sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
      return timeB - timeA
    })

  return <MessagesPage currentUserId={user.id} role={role} initialConversations={conversations} initialUserId={searchParams.userId} />
}

