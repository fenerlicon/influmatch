'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CreateSupportTicketPayload {
  subject: 'Ödeme Sorunu' | 'Teknik Hata' | 'Şikayet/Bildirim' | 'Öneri'
  priority: 'Düşük' | 'Orta' | 'Acil'
  message: string
  fileUrl?: string | null
}

export async function createSupportTicket(
  payload: CreateSupportTicketPayload,
): Promise<{ success: boolean; error?: string; ticketId?: string; ticketNumber?: number }> {
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

    // Get ticket number before inserting (count existing tickets)
    const { count: existingCount } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const ticketNumber = (existingCount ?? 0) + 1

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
      return { success: false, error: error.message || 'Destek talebi oluşturulamadı' }
    }

    revalidatePath('/dashboard/influencer/settings')
    revalidatePath('/dashboard/brand/settings')
    
    return { success: true, ticketId: ticket.id, ticketNumber }
  } catch (error) {
    console.error('[createSupportTicket] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

