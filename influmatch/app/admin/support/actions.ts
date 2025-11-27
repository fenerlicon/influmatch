'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const ADMIN_EMAIL = 'admin@influmatch.net'

async function checkAdminAccess() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, error: 'Oturum açmanız gerekiyor' }
  }

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { isAdmin: false, error: 'Bu işlem için yetkiniz yok' }
  }

  return { isAdmin: true, userId: user.id }
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'closed',
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminCheck = await checkAdminAccess()
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error || 'Yetkisiz erişim' }
    }

    const supabase = createSupabaseServerClient()
    const { error } = await supabase
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)

    if (error) {
      console.error('[updateSupportTicketStatus] error:', error)
      return { success: false, error: error.message || 'Durum güncellenemedi' }
    }

    revalidatePath('/admin/support')
    return { success: true }
  } catch (error) {
    console.error('[updateSupportTicketStatus] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

export async function addAdminResponse(
  ticketId: string,
  response: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminCheck = await checkAdminAccess()
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error || 'Yetkisiz erişim' }
    }

    const supabase = createSupabaseServerClient()
    const { error } = await supabase
      .from('support_tickets')
      .update({
        admin_response: response,
        status: 'in_progress', // Auto update status when admin responds
      })
      .eq('id', ticketId)

    if (error) {
      console.error('[addAdminResponse] error:', error)
      return { success: false, error: error.message || 'Yanıt eklenemedi' }
    }

    revalidatePath('/admin/support')
    return { success: true }
  } catch (error) {
    console.error('[addAdminResponse] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

