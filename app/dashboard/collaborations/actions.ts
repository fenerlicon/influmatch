'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { runCollaborationAction, type CollaborationActionInput } from '@/lib/collaborations'

// Yetki kontrolü ortak kodda: kullanıcı kaydın tarafı değilse veya işlem rolüne/duruma uymuyorsa reddedilir.
export async function collaborationAction(
  collaborationId: string,
  input: CollaborationActionInput,
): Promise<{ success: true; error?: undefined; roomId?: string | null } | { success?: undefined; error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }

  const result = await runCollaborationAction(user.id, collaborationId, {
    action: input?.action,
    url: typeof input?.url === 'string' ? input.url : null,
    reason: typeof input?.reason === 'string' ? input.reason : null,
  })
  if (result.success) revalidatePath('/dashboard/collaborations')
  return result
}
