import { redirect } from 'next/navigation'
import MessagesPage from '@/components/messages/MessagesPage'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getLastReadMap } from '@/lib/room-reads'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardMessagesPage({
  searchParams,
}: {
  searchParams: { userId?: string, roomId?: string }
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
    .select('role, verification_status')
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

  // Her oda için yalnızca son mesaj ve okunmamış sayısı çekilir. Tüm mesajları tek sorguda
  // almak PostgREST'in 1000 satır sınırına takılıyor, son mesajlar ve sayılar kesiliyordu.
  const roomIds = rooms?.map((r) => r.id) ?? []
  const lastReadMap = await getLastReadMap(supabase, user.id, roomIds)
  const lastMessageMap = new Map<string, { id: string; room_id: string; sender_id: string; content: string; created_at: string }>()
  const unreadCounts = new Map<string, number>()

  const ROOM_BATCH = 20
  for (let i = 0; i < roomIds.length; i += ROOM_BATCH) {
    await Promise.all(
      roomIds.slice(i, i + ROOM_BATCH).map(async (roomId) => {
        const lastRead = lastReadMap.get(roomId)
        let unreadQuery = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .neq('sender_id', user.id)
        if (lastRead) unreadQuery = unreadQuery.gt('created_at', lastRead)

        const [lastResult, unreadResult] = await Promise.all([
          supabase
            .from('messages')
            .select('id, room_id, sender_id, content, created_at')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          unreadQuery,
        ])

        if (lastResult.error) {
          console.error('[DashboardMessagesPage] last message error', lastResult.error.message)
        } else if (lastResult.data) {
          lastMessageMap.set(roomId, lastResult.data)
        }
        if (unreadResult.error) {
          console.error('[DashboardMessagesPage] unread count error', unreadResult.error.message)
        } else if (unreadResult.count) {
          unreadCounts.set(roomId, unreadResult.count)
        }
      }),
    )
  }

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
            verificationStatus: (otherParticipant.verification_status as 'pending' | 'verified' | 'rejected' | null | undefined) ?? undefined,
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

  return <MessagesPage currentUserId={user.id} role={role} initialConversations={conversations} initialUserId={searchParams.userId} initialRoomId={searchParams.roomId} currentUserVerificationStatus={userProfile?.verification_status as 'pending' | 'verified' | 'rejected' | undefined} />
}
