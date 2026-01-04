'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function checkIfBlocked(otherUserId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { blocked: false, hasBlocked: false }
  }

  // Check if current user is blocked by the other user (can't send messages to them)
  const { data: blockCheck } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', otherUserId)
    .eq('blocked_user_id', user.id)
    .maybeSingle()

  const isBlockedByOther = !!blockCheck

  // Also check if current user has blocked the other user
  const { data: hasBlocked } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', user.id)
    .eq('blocked_user_id', otherUserId)
    .maybeSingle()

  return {
    blocked: isBlockedByOther,
    hasBlocked: !!hasBlocked,
  }
}

export async function markRoomAsRead(roomId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Oturum açılmamış.' }

  try {
    // Get unread messages in this room sent by others
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .eq('room_id', roomId)
      .neq('sender_id', user.id)

    if (msgError) {
      console.error('Error fetching messages to mark as read:', msgError)
      return { error: msgError.message }
    }

    if (!messages || messages.length === 0) return { success: true }

    // Prepare records for message_reads
    const records = messages.map(m => ({
      message_id: m.id,
      user_id: user.id
    }))

    // Upsert into message_reads
    const { error: upsertError } = await supabase
      .from('message_reads')
      .upsert(records, {
        onConflict: 'message_id,user_id',
        ignoreDuplicates: true
      })

    if (upsertError) {
      console.error('Error marking messages as read:', upsertError)
      return { error: upsertError.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Unexpected error in markRoomAsRead:', err)
    return { error: 'Beklenmeyen bir hata oluştu.' }
  }
}

export async function getTotalUnreadCount() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  try {
    // 1. Get Room IDs
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id')
      .or(`brand_id.eq.${user.id},influencer_id.eq.${user.id}`)

    if (!rooms || rooms.length === 0) return 0
    const roomIds = rooms.map((r) => r.id)

    // 2. Get recent messages
    // Fetch messages from the last 7 days to optimize query
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const { data: messages } = await supabase
      .from('messages')
      .select('id, room_id, created_at, sender_id')
      .in('room_id', roomIds)
      .neq('sender_id', user.id)
      .gte('created_at', oneWeekAgo.toISOString())

    if (!messages || messages.length === 0) return 0

    // 3. Filter using user_metadata
    const userMetadata = user.user_metadata || {}
    let count = 0

    messages.forEach((msg) => {
      const lastRead = userMetadata[`last_read_${msg.room_id}`]
      // If never read OR message is newer than last read time
      if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
        count++
      }
    })

    return count
  } catch (error) {
    console.error('Error calculating total unread count:', error)
    return 0
  }
}
