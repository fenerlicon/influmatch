// Mesaj göndermenin ortak çekirdeği (web sunucu aksiyonu ve mobil uç). Oda üyeliği, engelleme ve marka onayı
// kontrol edilir; alıcıya bildirim gider (lib/notify.ts). Kullanıcının kendi istemcisiyle çalışır, RLS uygulanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { chatAttachmentPath, parseChatImageUrl } from '@/lib/chat-image'
import { runInBackground } from '@/lib/background'

const MAX_MESSAGE_LENGTH = 5000

export interface SentMessage {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
}

/**
 * Odaya yazma izni: gönderen (marka ise onaylı), oda üyeliği, kapalı oda ve engelleme. Mesaj gönderiminde ve sohbet görseli
 * yükleme adresi verilirken (lib/chat-upload.ts) aynı kontrol kullanılır. Kullanıcının kendi istemcisiyle (RLS) çalışır.
 */
export async function checkRoomWritableAs(
  supabase: SupabaseClient,
  userId: string,
  roomId: string,
): Promise<{ ok: true; otherUserId: string } | { ok: false; error: string }> {
  // Gönderen ve oda kontrolleri aynı anda (2026-10-19: sırayla üç sorgu gönderimi yavaşlatıyordu).
  const [{ data: sender }, { data: room }] = await Promise.all([
    supabase.from('users').select('role, verification_status').eq('id', userId).maybeSingle(),
    supabase.from('rooms').select('brand_id, influencer_id, closed_at').eq('id', roomId).maybeSingle(),
  ])
  if (sender?.role === 'brand' && sender.verification_status !== 'verified') {
    return { ok: false, error: 'Mesaj göndermek için hesabınızın onaylanması gerekmektedir.' }
  }
  if (!room) return { ok: false, error: 'Sohbet bulunamadı.' }
  if (room.brand_id !== userId && room.influencer_id !== userId) {
    return { ok: false, error: 'Bu sohbete erişim yetkiniz yok.' }
  }
  // Kapalı oda salt okunur (3.6-S8; DB tetikleyicisi de reddeder).
  if (room.closed_at) return { ok: false, error: 'Bu sohbet kapandı; yeni mesaj gönderilemez.' }

  const otherUserId = (room.brand_id === userId ? room.influencer_id : room.brand_id) as string | null
  if (!otherUserId) return { ok: false, error: 'Geçersiz sohbet.' }

  const { data: blocks } = await supabase
    .from('user_blocks')
    .select('blocker_user_id')
    .or(`and(blocker_user_id.eq.${otherUserId},blocked_user_id.eq.${userId}),and(blocker_user_id.eq.${userId},blocked_user_id.eq.${otherUserId})`)
  if (blocks?.some((b) => b.blocker_user_id === otherUserId)) {
    return { ok: false, error: 'Bu kullanıcı sizi engellemiş. Mesaj gönderemezsiniz.' }
  }
  if (blocks?.some((b) => b.blocker_user_id === userId)) {
    return { ok: false, error: 'Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.' }
  }
  return { ok: true, otherUserId }
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

  // Görsel mesaj yalnızca bu odaya, gönderenin kendi klasörüne yüklenmiş dosyayı gösterebilir
  // (web ve mobil aynı yol: {oda}/{gönderen}/{dosya}).
  const imageUrl = parseChatImageUrl(content)
  if (imageUrl && !chatAttachmentPath(imageUrl)?.startsWith(`${roomId}/${userId}/`)) {
    return { success: false, error: 'Geçersiz görsel.' }
  }

  const access = await checkRoomWritableAs(supabase, userId, roomId)
  if (!access.ok) return { success: false, error: access.error }
  const otherUserId = access.otherUserId

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
  // Yanıttan sonra arka planda (bildirim + push + e-posta gönderimi mesajın görünmesini bekletmesin).
  await runInBackground('message-notify', async () => {
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
  })

  return { success: true, data: data as SentMessage }
}
