'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { ticketCode } from '@/lib/support-ticket'
import { isAllowedAttachmentUrl } from '@/lib/attachment-url'
import { revalidatePath } from 'next/cache'

export interface CreateSupportTicketPayload {
  subject: 'Ödeme Sorunu' | 'Teknik Hata' | 'Şikayet/Bildirim' | 'Öneri'
  priority: 'Düşük' | 'Orta' | 'Acil'
  message: string
  fileUrl?: string | null
}

export async function createSupportTicket(
  payload: CreateSupportTicketPayload,
): Promise<{ success: boolean; error?: string; ticketId?: string; ticketCode?: string }> {
  try {
    const supabase = createSupabaseServerClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Oturum açmanız gerekiyor' }
    }

    // Validate required fields
    if (!payload.subject || !payload.message || !payload.priority) {
      return { success: false, error: 'Lütfen tüm zorunlu alanları doldurun' }
    }

    if (payload.message.trim().length < 10) {
      return { success: false, error: 'Mesaj en az 10 karakter olmalıdır' }
    }

    if (!isAllowedAttachmentUrl(payload.fileUrl)) {
      return { success: false, error: 'Dosya bağlantısı geçersiz. Lütfen dosyayı yeniden yükleyin.' }
    }

    // Create support ticket
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject: payload.subject,
        priority: payload.priority,
        message: payload.message.trim(),
        file_url: payload.fileUrl || null,
        status: 'open',
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('[createSupportTicket] error:', error)
      return { success: false, error: 'Destek talebi oluşturulamadı. Lütfen tekrar deneyin.' }
    }

    revalidatePath('/dashboard/influencer/settings')
    revalidatePath('/dashboard/brand/settings')
    
    return { success: true, ticketId: ticket.id, ticketCode: ticketCode(ticket.id) }
  } catch (error) {
    console.error('[createSupportTicket] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

