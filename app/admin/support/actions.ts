'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifyUser } from '@/lib/notify'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'


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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

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

    const trimmed = response?.trim()
    if (!trimmed) {
      return { success: false, error: 'Yanıt boş olamaz' }
    }

    const supabase = createSupabaseServerClient()
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update({ admin_response: trimmed })
      .eq('id', ticketId)
      .select('user_id, subject')
      .maybeSingle()

    if (error || !ticket) {
      console.error('[addAdminResponse] error:', error)
      return { success: false, error: 'Yanıt eklenemedi.' }
    }

    // Yanıt metni e-postaya konmaz; kullanıcı panelde okur.
    const admin = createSupabaseAdminClient()
    const ownerRole = admin ? await fetchAccountRole(admin, ticket.user_id as string) : null
    await notifyUser({
      userId: ticket.user_id as string,
      event: 'support_reply',
      title: 'Destek talebinize yanıt verildi',
      message: `"${ticket.subject}" konulu destek talebinize yanıt verildi.`,
      link: ownerRole === 'brand' ? '/dashboard/brand/settings' : '/dashboard/influencer/settings',
    }, admin)

    // Yalnızca açık talep "işlemde"ye alınır; kapatılmış talep yanıt eklenince yeniden açılmaz.
    const { error: statusError } = await supabase
      .from('support_tickets')
      .update({ status: 'in_progress' })
      .eq('id', ticketId)
      .eq('status', 'open')
    if (statusError) {
      console.error('[addAdminResponse] status error:', statusError)
    }

    revalidatePath('/admin/support')
    return { success: true }
  } catch (error) {
    console.error('[addAdminResponse] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

