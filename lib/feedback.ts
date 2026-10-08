// Geri bildirim gönderme: web (app/feedback/actions.ts) ve mobil (/api/mobile/feedback) aynı kodu kullanır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isAllowedAttachmentUrl } from '@/lib/attachment-url'

export interface SubmitFeedbackPayload {
  description: string
  imageUrl?: string | null
}

export async function submitFeedbackAs(
  supabase: SupabaseClient,
  userId: string,
  payload: SubmitFeedbackPayload,
): Promise<{ success?: true; error?: string }> {
  if (!payload?.description || typeof payload.description !== 'string' || payload.description.trim().length === 0) {
    return { error: 'Lütfen geri bildiriminizi yazın.' }
  }

  if (!isAllowedAttachmentUrl(payload.imageUrl)) {
    return { error: 'Görsel bağlantısı geçersiz. Lütfen görseli yeniden yükleyin.' }
  }

  // Rol veritabanından (user_metadata kullanıcı tarafından değiştirilebilir).
  const { data: userProfile } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()

  const role = (userProfile?.role ?? 'influencer') as 'influencer' | 'brand' | 'admin'

  const { error: insertError } = await supabase.from('feedback_submissions').insert({
    user_id: userId,
    role,
    description: payload.description.trim(),
    image_url: payload.imageUrl || null,
    status: 'pending',
  })

  if (insertError) {
    console.error('[submitFeedback] insert error', insertError)
    return { error: 'Geri bildirim gönderilemedi. Lütfen tekrar deneyin.' }
  }

  return { success: true }
}
