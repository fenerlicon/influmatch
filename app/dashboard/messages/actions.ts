'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getLastReadMap } from '@/lib/room-reads'

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

    // 3. Okundu zamanları room_reads tablosundan
    const lastReadMap = await getLastReadMap(supabase, user.id, roomIds)
    let count = 0

    messages.forEach((msg) => {
      const lastRead = lastReadMap.get(msg.room_id)
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
