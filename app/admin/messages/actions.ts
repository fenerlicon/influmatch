'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'


export async function updateReportStatus(
  reportId: string,
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed',
) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const updateData: any = {
    status,
  }

  if (status !== 'pending') {
    updateData.reviewed_at = new Date().toISOString()
    updateData.reviewed_by = user.id
  }

  const { error } = await supabase
    .from('message_reports')
    .update(updateData)
    .eq('id', reportId)

  if (error) {
    return { error: `Rapor durumu güncellenemedi: ${error.message}` }
  }

  revalidatePath('/admin/messages')
  return { success: true }
}

const REMOVED_MESSAGE_TEXT = 'Bu mesaj platform kurallarına aykırı bulunduğu için yönetim tarafından kaldırıldı.'

/**
 * Şikayet edilen mesajı kaldırır. Satır silinmez (silme şikayet kaydını CASCADE ile götürürdü):
 * orijinal içerik şikayet kayıtlarına yazılır, mesaj içeriği sabit metinle değiştirilir.
 * messages tablosundaki koruma trigger'ları yalnızca istemci rollerini durdurur; service role ile yapılır.
 */
export async function deleteMessage(messageId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (adminProfile?.role !== 'admin') {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return { error: 'Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.' }
  }

  const { data: message, error: readError } = await admin
    .from('messages')
    .select('id, content')
    .eq('id', messageId)
    .maybeSingle()

  if (readError || !message) {
    return { error: 'Mesaj bulunamadı.' }
  }
  if (message.content === REMOVED_MESSAGE_TEXT) {
    return { error: 'Bu mesaj zaten kaldırılmış.' }
  }

  const now = new Date().toISOString()
  const { error: reportError } = await admin
    .from('message_reports')
    .update({
      message_snapshot: message.content,
      message_removed_at: now,
      status: 'resolved',
      reviewed_at: now,
      reviewed_by: user.id,
    })
    .eq('message_id', messageId)

  if (reportError) {
    return { error: `Şikayet kaydı güncellenemedi: ${reportError.message}` }
  }

  const { error: updateError } = await admin
    .from('messages')
    .update({ content: REMOVED_MESSAGE_TEXT })
    .eq('id', messageId)

  if (updateError) {
    return { error: `Mesaj kaldırılamadı: ${updateError.message}` }
  }

  revalidatePath('/admin/messages')
  return { success: true, removedAt: now }
}
