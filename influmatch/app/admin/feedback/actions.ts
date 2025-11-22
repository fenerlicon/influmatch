'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

const ADMIN_EMAIL = 'admin@influmatch.net'

export async function updateFeedbackStatus(
  feedbackId: string,
  status: 'pending' | 'reviewed' | 'resolved' | 'archived'
) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum bulunamadı.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const { error } = await supabase
    .from('feedback_submissions')
    .update({ status })
    .eq('id', feedbackId)

  if (error) {
    return { error: `Durum güncellenemedi: ${error.message}` }
  }

  revalidatePath('/admin/feedback')
  return { success: true }
}

