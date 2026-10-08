// Destek talebi oluşturma: web (app/dashboard/influencer/settings/support/actions.ts) ve mobil
// (/api/mobile/support) aynı kodu kullanır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ticketCode } from '@/lib/support-ticket'
import { isAllowedAttachmentUrl } from '@/lib/attachment-url'

export const SUPPORT_SUBJECTS = ['Ödeme Sorunu', 'Teknik Hata', 'Şikayet/Bildirim', 'Öneri'] as const
export const SUPPORT_PRIORITIES = ['Düşük', 'Orta', 'Acil'] as const

export interface CreateSupportTicketPayload {
  subject: (typeof SUPPORT_SUBJECTS)[number]
  priority: (typeof SUPPORT_PRIORITIES)[number]
  message: string
  fileUrl?: string | null
}

export type CreateSupportTicketResult = { success: boolean; error?: string; ticketId?: string; ticketCode?: string }

export async function createSupportTicketAs(
  supabase: SupabaseClient,
  userId: string,
  payload: CreateSupportTicketPayload,
): Promise<CreateSupportTicketResult> {
  // Validate required fields
  if (!payload?.subject || !payload.message || !payload.priority) {
    return { success: false, error: 'Lütfen tüm zorunlu alanları doldurun' }
  }

  if (!SUPPORT_SUBJECTS.includes(payload.subject) || !SUPPORT_PRIORITIES.includes(payload.priority)) {
    return { success: false, error: 'Lütfen tüm zorunlu alanları doldurun' }
  }

  if (typeof payload.message !== 'string' || payload.message.trim().length < 10) {
    return { success: false, error: 'Mesaj en az 10 karakter olmalıdır' }
  }

  if (!isAllowedAttachmentUrl(payload.fileUrl)) {
    return { success: false, error: 'Dosya bağlantısı geçersiz. Lütfen dosyayı yeniden yükleyin.' }
  }

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject: payload.subject,
      priority: payload.priority,
      message: payload.message.trim(),
      file_url: payload.fileUrl || null,
      status: 'open',
    })
    .select('id, created_at')
    .single()

  if (error || !ticket) {
    console.error('[createSupportTicket] error:', error)
    return { success: false, error: 'Destek talebi oluşturulamadı. Lütfen tekrar deneyin.' }
  }

  return { success: true, ticketId: ticket.id, ticketCode: ticketCode(ticket.id) }
}
