'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { submitFeedbackAs, type SubmitFeedbackPayload } from '@/lib/feedback'

export async function submitFeedback(payload: SubmitFeedbackPayload) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum bulunamadı. Lütfen yeniden giriş yapın.' }
  }

  // Doğrulama ve kayıt ortak kodda (lib/feedback.ts); mobil uç da aynısını kullanır.
  const result = await submitFeedbackAs(supabase, user.id, payload)
  if (result.error) return { error: result.error }

  revalidatePath('/admin/feedback')
  return { success: true }
}
