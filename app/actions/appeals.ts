'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { createAppealUploadUrlAs, submitAppealAs, type SubmitAppealInput } from '@/lib/moderation'

// İtiraz (kullanıcı, 2026-10-26). Kurallar sunucuda (lib/moderation.ts); mobil aynı fonksiyonları /api/mobile/appeals üzerinden çağırır.
// Reddedilmiş hesap da (panele giremese de) oturum açıkken buradan itiraz eder.
async function currentUserId() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function submitAppeal(input: SubmitAppealInput) {
  const userId = await currentUserId()
  if (!userId) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }
  const safe = input && typeof input === 'object' ? { decisionId: input.decisionId, message: input.message, attachmentPath: input.attachmentPath } : {}
  const result = await submitAppealAs(createSupabaseAdminClient(), userId, safe)
  if (result.success) {
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/admin/appeals')
  }
  return result
}

export async function requestAppealUploadUrl(extension: string) {
  const userId = await currentUserId()
  if (!userId) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }
  return createAppealUploadUrlAs(createSupabaseAdminClient(), userId, extension)
}
