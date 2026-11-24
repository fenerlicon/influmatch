// Sohbet görseli için imzalı yükleme adresi (mobil, 3.22-N2). Web sohbeti oda katılımcısı olarak kovaya doğrudan yükler
// (storage RLS: {oda}/{kendi id}/...); mobil aynı kovaya, aynı yola, sunucu kontrolünden sonra imzalı adresle yükler:
// oda üyeliği, kapalı oda, engelleme ve marka onayı mesaj gönderimiyle aynı (checkRoomWritableAs). Kova gizli, 5 MB ve
// yalnızca görsel türleri kabul eder (kova ayarı); mesaj gönderilirken yol yine doğrulanır (sendMessageAs).
//
// R2 (2026-11-24): `size` gönderilirse ve R2 ayarlıysa dosya Cloudflare R2'ye yüklenir (imzalı PUT, Supabase kotası harcanmaz);
// yanıtta `provider: 'r2'`, mesajda saklanacak referans `url` (r2://chat/...). Aksi halde eski Supabase yolu (`provider: 'supabase'`).
// Web sohbeti de R2 açıkken bu fonksiyonu sunucu aksiyonuyla çağırır (app/dashboard/messages/send/actions.ts).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { checkRoomWritableAs } from '@/lib/messages'
import { CHAT_FULL_EXTENSIONS, CHAT_FULL_IMAGE_MAX_BYTES, CHAT_IMAGE_MAX_BYTES, chatAttachmentUrl } from '@/lib/chat-image'
import { createR2UploadUrl, isR2Configured, r2FileStem, r2Ref } from '@/lib/r2'

export const CHAT_ATTACHMENT_BUCKET = 'chat-attachments'
const CHAT_UPLOAD_TYPES: Record<string, string> = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' }

export type ChatUploadUrlResult =
  | { success: true; provider: 'supabase'; path: string; token: string; url: string; contentType: string }
  | {
      success: true
      provider: 'r2'
      uploadUrl: string
      url: string
      contentType: string
      size: number
      /** Tam boy dosya (istenmişse ve sınır içindeyse): aynı şekilde PUT edilir. */
      full: { uploadUrl: string; contentType: string; size: number } | null
    }
  | { success: false; error: string }

export async function createChatUploadUrlAs(
  supabase: SupabaseClient,
  userId: string,
  roomId: string,
  extension: string,
  size?: number,
  full?: { extension: string; size: number } | null,
): Promise<ChatUploadUrlResult> {
  const contentType = CHAT_UPLOAD_TYPES[extension]
  if (!contentType) return { success: false, error: 'Yalnızca görsel gönderebilirsin (JPEG, PNG, WEBP).' }
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) return { success: false, error: 'Sohbet bulunamadı.' }

  const access = await checkRoomWritableAs(supabase, userId, roomId)
  if (!access.ok) return { success: false, error: access.error }

  if (size !== undefined && isR2Configured()) {
    if (!Number.isInteger(size) || size <= 0) return { success: false, error: 'Geçersiz dosya.' }
    if (size > CHAT_IMAGE_MAX_BYTES) return { success: false, error: 'Görsel en fazla 5 MB olabilir.' }
    const stem = `chat/${roomId.toLowerCase()}/${userId.toLowerCase()}/${r2FileStem()}`
    const key = `${stem}.${extension}`
    const uploadUrl = await createR2UploadUrl(key, contentType, size)
    if (!uploadUrl) return { success: false, error: 'Yükleme başlatılamadı. Tekrar dene.' }

    // Tam boy (orijinal) dosya: sohbette önizleme görünür, "İndir" tam boyu verir. Sınırı aşan / desteklenmeyen tür atlanır.
    let fullUpload: { uploadUrl: string; contentType: string; size: number } | null = null
    let ref = r2Ref(key)
    const fullExt = full?.extension === 'jpeg' ? 'jpg' : full?.extension
    if (fullExt && (CHAT_FULL_EXTENSIONS as readonly string[]).includes(fullExt) && Number.isInteger(full!.size) && full!.size > 0 && full!.size <= CHAT_FULL_IMAGE_MAX_BYTES) {
      const fullType = CHAT_UPLOAD_TYPES[fullExt]
      const fullUrl = await createR2UploadUrl(`${stem}_full.${fullExt}`, fullType, full!.size)
      if (fullUrl) {
        fullUpload = { uploadUrl: fullUrl, contentType: fullType, size: full!.size }
        ref = `${ref}?full=${fullExt}`
      }
    }
    return { success: true, provider: 'r2', uploadUrl, url: ref, contentType, size, full: fullUpload }
  }

  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }
  const path = `${roomId}/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${extension}`
  const { data, error } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[createChatUploadUrl]', error?.message)
    return { success: false, error: 'Yükleme başlatılamadı. Tekrar dene.' }
  }
  return { success: true, provider: 'supabase', path: data.path, token: data.token, url: chatAttachmentUrl(data.path), contentType }
}
