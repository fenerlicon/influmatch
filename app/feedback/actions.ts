'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

interface SubmitFeedbackPayload {
  description: string
  imageUrl?: string | null
}

export async function submitFeedback(payload: SubmitFeedbackPayload) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum bulunamadı. Lütfen yeniden giriş yapın.' }
  }

  if (!payload.description || payload.description.trim().length === 0) {
    return { error: 'Lütfen geri bildiriminizi yazın.' }
  }

  // Get user role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (userProfile?.role ?? 'influencer') as 'influencer' | 'brand'

  const { error: insertError } = await supabase.from('feedback_submissions').insert({
    user_id: user.id,
    role,
    description: payload.description.trim(),
    image_url: payload.imageUrl || null,
    status: 'pending',
  })

  if (insertError) {
    console.error('[submitFeedback] insert error', insertError)
    return { error: 'Geri bildirim gönderilemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath('/admin/feedback')
  return { success: true }
}

