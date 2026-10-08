'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { parseChatImageUrl } from '@/lib/chat-image'

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
    return { success: false, error: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' }
  }

  // Mesaj içeriği Postgres loglarına yazılmaz (eski log_message RPC'si içeriğin ilk 200
  // karakterini loglara düşüyordu; mesajlar zaten messages tablosunda saklanıyor).

  // Update last_read in user metadata to mark this room as seen by the sender
  try {
    const now = new Date().toISOString()
    await supabase.auth.updateUser({
      data: {
        [`last_read_${roomId}`]: now
      }
    })
  } catch (error) {
    console.warn('[sendMessage] Failed to update last_read metadata:', error)
  }

  // Alıcıya bildirim: oda başına saatte en fazla bir; alıcı çevrimiçiyse e-posta gitmez (lib/notify.ts).
  const admin = createSupabaseAdminClient()
  const senderName = await displayNameOf(admin, user.id)
  const preview = parseChatImageUrl(content.trim()) ? '📷 Fotoğraf' : content.trim().slice(0, 140)
  await notifyUser(
    {
      userId: otherUserId,
      event: 'message_new',
      title: `${senderName} size mesaj gönderdi`,
      message: preview,
      link: `/dashboard/messages?roomId=${roomId}`,
      // Mesaj içeriği e-postaya (üçüncü taraf sağlayıcıya) konmaz.
      email: { subject: 'Yeni mesajınız var', text: `${senderName} size Influmatch üzerinden mesaj gönderdi.` },
    },
    admin,
  )

  revalidatePath('/dashboard/messages')
  return { success: true, data }
}

