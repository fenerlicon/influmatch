'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { sendMessageAs } from '@/lib/messages'
import { markRoomsRead } from '@/lib/room-reads'
import { createChatUploadUrlAs } from '@/lib/chat-upload'
import { chatAttachmentDownloadAs, signChatAttachmentsAs } from '@/lib/chat-attachments'
import { isR2Configured } from '@/lib/r2'

export async function sendMessage(roomId: string, content: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }

  const result = await sendMessageAs(supabase, user.id, roomId, content)
  if (!result.success) return result

  // Gönderen için oda okundu sayılır (room_reads, lib/room-reads.ts).
  // revalidatePath yok (2026-10-19): sohbet istemcide anında güncellenir (iyimser gönderim + Realtime); sayfayı her
  // mesajda sunucuda baştan üretmek gönderimi yavaşlatıyordu.
  await markRoomsRead(supabase, user.id, [roomId])
  return result
}

/**
 * Sohbet görseli yükleme adresi (R2, 2026-11-24). R2 ayarlı değilse `{ success: true, provider: 'none' }` döner ve istemci
 * eski yoldan (Supabase Storage, RLS ile doğrudan yükleme) devam eder.
 */
export async function createChatUpload(roomId: string, extension: string, size: number, full?: { extension: string; size: number } | null) {
  if (!isR2Configured()) return { success: true as const, provider: 'none' as const }
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }
  return createChatUploadUrlAs(supabase, user.id, roomId, extension, size, full ?? null)
}

/** R2'deki sohbet görsellerinin (önizleme) görüntüleme bağlantıları (yalnızca odanın tarafları). */
export async function signChatAttachments(refs: string[]): Promise<Record<string, string>> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return {}
  return signChatAttachmentsAs(supabase, user.id, refs)
}

/** "İndir": tam boy görselin 10 dakikalık indirme bağlantısı (yalnızca odanın tarafları). */
export async function downloadChatAttachment(ref: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }
  return chatAttachmentDownloadAs(supabase, user.id, ref)
}
