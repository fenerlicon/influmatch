// Sohbet görseli için imzalı yükleme adresi (mobil, 3.22-N2). Web sohbeti oda katılımcısı olarak kovaya doğrudan yükler
// (storage RLS: {oda}/{kendi id}/...); mobil aynı kovaya, aynı yola, sunucu kontrolünden sonra imzalı adresle yükler:
// oda üyeliği, kapalı oda, engelleme ve marka onayı mesaj gönderimiyle aynı (checkRoomWritableAs). Kova gizli, 5 MB ve
// yalnızca görsel türleri kabul eder (kova ayarı); mesaj gönderilirken yol yine doğrulanır (sendMessageAs).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { checkRoomWritableAs } from '@/lib/messages'
import { chatAttachmentUrl } from '@/lib/chat-image'

export const CHAT_ATTACHMENT_BUCKET = 'chat-attachments'
const CHAT_UPLOAD_TYPES: Record<string, string> = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' }

export type ChatUploadUrlResult =
  | { success: true; path: string; token: string; url: string; contentType: string }
  | { success: false; error: string }

export async function createChatUploadUrlAs(
  supabase: SupabaseClient,
  userId: string,
  roomId: string,
  extension: string,
): Promise<ChatUploadUrlResult> {
  const contentType = CHAT_UPLOAD_TYPES[extension]
  if (!contentType) return { success: false, error: 'Yalnızca görsel gönderebilirsin (JPEG, PNG, WEBP).' }
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) return { success: false, error: 'Sohbet bulunamadı.' }

  const access = await checkRoomWritableAs(supabase, userId, roomId)
  if (!access.ok) return { success: false, error: access.error }

  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }
  const path = `${roomId}/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${extension}`
  const { data, error } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[createChatUploadUrl]', error?.message)
    return { success: false, error: 'Yükleme başlatılamadı. Tekrar dene.' }
  }
  return { success: true, path: data.path, token: data.token, url: chatAttachmentUrl(data.path), contentType }
}
