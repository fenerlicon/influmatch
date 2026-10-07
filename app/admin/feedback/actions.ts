'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'


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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const { error } = await supabase
    .from('feedback_submissions')
    .update({ status })
    .eq('id', feedbackId)

  if (error) {
    console.error('[updateFeedbackStatus] error:', error)
    return { error: 'Durum güncellenemedi.' }
  }

  revalidatePath('/admin/feedback')
  return { success: true }
}


export async function updateFeedbackNote(feedbackId: string, note: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum bulunamadı.' }

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' }

  const cleanNote = note.trim()
  if (cleanNote.length > 2000) return { error: 'Not en fazla 2000 karakter olabilir.' }

  const { error } = await supabase
    .from('feedback_submissions')
    .update({ admin_notes: cleanNote || null })
    .eq('id', feedbackId)

  if (error) {
    console.error('[updateFeedbackNote] error:', error)
    return { error: 'Not kaydedilemedi.' }
  }

  revalidatePath('/admin/feedback')
  return { success: true }
}
