// Mesaj göndermenin ortak çekirdeği (web sunucu aksiyonu ve mobil uç). Oda üyeliği, engelleme ve marka onayı
// kontrol edilir; alıcıya bildirim gider (lib/notify.ts). Kullanıcının kendi istemcisiyle çalışır, RLS uygulanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { parseChatImageUrl } from '@/lib/chat-image'

const MAX_MESSAGE_LENGTH = 5000

export interface SentMessage {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
}

export async function sendMessageAs(
  supabase: SupabaseClient,
  userId: string,
  roomId: string,
  rawContent: string,
): Promise<{ success: true; data: SentMessage } | { success: false; error: string }> {
  const content = (rawContent ?? '').trim()
  if (!content) return { success: false, error: 'Mesaj içeriği boş olamaz.' }
  if (content.length > MAX_MESSAGE_LENGTH) return { success: false, error: 'Mesaj çok uzun.' }

  const { data: sender } = await supabase.from('users').select('role, verification_status').eq('id', userId).maybeSingle()
  if (sender?.role === 'brand' && sender.verification_status !== 'verified') {
    return { success: false, error: 'Mesaj göndermek için hesabınızın onaylanması gerekmektedir.' }
  }

  const { data: room } = await supabase.from('rooms').select('brand_id, influencer_id').eq('id', roomId).maybeSingle()
  if (!room) return { success: false, error: 'Sohbet bulunamadı.' }
  if (room.brand_id !== userId && room.influencer_id !== userId) {
    return { success: false, error: 'Bu sohbete erişim yetkiniz yok.' }
  }

  const otherUserId = (room.brand_id === userId ? room.influencer_id : room.brand_id) as string | null
  if (!otherUserId) return { success: false, error: 'Geçersiz sohbet.' }

  const { data: blocks } = await supabase
    .from('user_blocks')
    .select('blocker_user_id')
    .or(`and(blocker_user_id.eq.${otherUserId},blocked_user_id.eq.${userId}),and(blocker_user_id.eq.${userId},blocked_user_id.eq.${otherUserId})`)
  if (blocks?.some((b) => b.blocker_user_id === otherUserId)) {
    return { success: false, error: 'Bu kullanıcı sizi engellemiş. Mesaj gönderemezsiniz.' }
  }
  if (blocks?.some((b) => b.blocker_user_id === userId)) {
    return { success: false, error: 'Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.' }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ room_id: roomId, sender_id: userId, content })
    .select()
    .single()
  if (error || !data) {
    console.error('[sendMessage] insert error:', error)
    return { success: false, error: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' }
  }

  // Alıcıya bildirim: oda başına saatte en fazla bir; alıcı çevrimiçiyse e-posta gitmez; içerik e-postaya konmaz.
  const admin = createSupabaseAdminClient()
  const senderName = await displayNameOf(admin, userId)
  await notifyUser(
    {
      userId: otherUserId,
      event: 'message_new',
      title: `${senderName} size mesaj gönderdi`,
      message: parseChatImageUrl(content) ? '📷 Fotoğraf' : content.slice(0, 140),
      link: `/dashboard/messages?roomId=${roomId}`,
      email: { subject: 'Yeni mesajınız var', text: `${senderName} size Influmatch üzerinden mesaj gönderdi.` },
    },
    admin,
  )

  return { success: true, data: data as SentMessage }
}
