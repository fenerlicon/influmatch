'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendMessage(roomId: string, content: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  // Check user role and verification status
  const { data: userData } = await supabase
    .from('users')
    .select('role, verification_status')
    .eq('id', user.id)
    .single()

  if (userData?.role === 'brand' && userData?.verification_status !== 'verified') {
    return { success: false, error: 'Mesaj göndermek için hesabınızın onaylanması gerekmektedir.' }
  }

  if (!content.trim()) {
    return { success: false, error: 'Mesaj içeriği boş olamaz.' }
  }

  // Get room details to check blocking
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('brand_id, influencer_id')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    return { success: false, error: 'Oda bulunamadı.' }
  }

  // Check if user is part of this room
  const isPartOfRoom = room.brand_id === user.id || room.influencer_id === user.id
  if (!isPartOfRoom) {
    return { success: false, error: 'Bu odaya erişim yetkiniz yok.' }
  }

  // Get the other participant
  const otherUserId = room.brand_id === user.id ? room.influencer_id : room.brand_id

  if (!otherUserId) {
    return { success: false, error: 'Geçersiz oda yapılandırması.' }
  }

  // Check if current user is blocked by the other user
  const { data: blockedCheck } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', otherUserId)
    .eq('blocked_user_id', user.id)
    .maybeSingle()

  if (blockedCheck) {
    return { success: false, error: 'Bu kullanıcı sizi engellemiş. Mesaj gönderemezsiniz.' }
  }

  // Check if current user has blocked the other user
  const { data: hasBlocked } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', user.id)
    .eq('blocked_user_id', otherUserId)
    .maybeSingle()

  if (hasBlocked) {
    return { success: false, error: 'Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.' }
  }

  // Insert message
  const { error: insertError, data } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select()
    .single()

  if (insertError) {
    console.error('Message insert error:', insertError)
    return { success: false, error: `Mesaj gönderilemedi: ${insertError.message}` }
  }

  // Log message to Supabase (using PostgreSQL function for logging)
  // This will appear in Supabase logs and message_logs table
  try {
    const { error: logError } = await supabase.rpc('log_message', {
      p_message_id: data.id,
      p_room_id: roomId,
      p_sender_id: user.id,
      p_receiver_id: otherUserId,
      p_content: content.trim(),
      p_created_at: new Date().toISOString(),
    })
    if (logError) {
      // Log function might not exist yet, that's okay
      console.warn('[sendMessage] Log function error (non-critical):', logError.message)
    }
  } catch (logError) {
    // Log function might not exist, that's okay - migration needs to be run
    console.warn('[sendMessage] Message log function not available (run migration: create_message_log_function.sql):', logError)
  }

  revalidatePath('/dashboard/messages')
  return { success: true, data }
}

