'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createTaskProofUploadUrlAs, submitTaskAs, type SubmitTaskInput } from '@/lib/tasks'

// Görevler (kullanıcı). Kurallar sunucuda (lib/tasks.ts); mobil aynı fonksiyonları /api/mobile/tasks üzerinden çağırır.
async function currentUserId() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function submitTask(input: SubmitTaskInput) {
  const userId = await currentUserId()
  if (!userId) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }
  const result = await submitTaskAs(userId, input && typeof input === 'object' ? input : {})
  if (result.success) revalidatePath('/dashboard/tasks')
  return result
}

export async function createTaskProofUploadUrl(extension: string) {
  const userId = await currentUserId()
  if (!userId) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }
  return createTaskProofUploadUrlAs(userId, extension)
}
