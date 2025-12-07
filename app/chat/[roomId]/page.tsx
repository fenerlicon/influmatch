import { redirect } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'

interface ChatPageProps {
  params: { roomId: string }
}

export const revalidate = 0

export default async function ChatRoomPage({ params }: ChatPageProps) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, brand_id, influencer_id, advert_application_id')
    .eq('id', params.roomId)
    .maybeSingle()

  if (roomError) {
    throw new Error(roomError.message)
  }

  if (!room || (room.brand_id !== user.id && room.influencer_id !== user.id)) {
    notFound()
  }

  const participantIds = [room.brand_id, room.influencer_id].filter(Boolean)
  const { data: participants, error: participantsError } = await supabase
    .from('users')
    .select('id, full_name, username, verification_status, role, displayed_badges')
    .in('id', participantIds)

  if (participantsError) {
    throw new Error(participantsError.message)
  }

  const brandProfile = participants?.find((profile) => profile.id === room.brand_id)
  const brandName = brandProfile?.full_name ?? brandProfile?.username ?? 'Marka'

  // Determine return URL: if room has advert_application_id, return to applications tab
  const isInfluencer = room.influencer_id === user.id
  const isBrand = room.brand_id === user.id
  let returnUrl: string | undefined = undefined

  if (room.advert_application_id) {
    if (isInfluencer) {
      returnUrl = '/dashboard/influencer/advert?tab=applications'
    } else if (isBrand) {
      returnUrl = '/dashboard/brand/advert?tab=applications'
    }
  }

  // Get the other participant's ID, verification status, and role
  const otherParticipantId = room.brand_id === user.id ? room.influencer_id : room.brand_id
  const otherParticipant = participants?.find((p) => p.id === otherParticipantId)
  const otherParticipantVerificationStatus = otherParticipant?.verification_status as 'pending' | 'verified' | 'rejected' | null | undefined
  const otherParticipantRole = otherParticipant?.role as 'influencer' | 'brand' | null | undefined
  const otherParticipantBadges = otherParticipant?.displayed_badges as string[] | undefined

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('id, sender_id, content, created_at')
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })

  if (messagesError) {
    throw new Error(messagesError.message)
  }

  return (
    <main className="min-h-screen bg-background px-1 py-2 text-white sm:px-2 sm:py-3">
      <div className="mx-auto w-full max-w-[98vw]">
        <ChatWindow
          roomId={room.id}
          currentUserId={user.id}
          initialMessages={messages ?? []}
          brandName={brandName}
          returnUrl={returnUrl}
          otherParticipantId={otherParticipantId}
          otherParticipantVerificationStatus={otherParticipantVerificationStatus}
          otherParticipantRole={otherParticipantRole}
          otherParticipantBadges={otherParticipantBadges}
        />
      </div>
    </main>
  )
}

