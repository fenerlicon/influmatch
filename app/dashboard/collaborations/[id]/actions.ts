'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { parseWorkspaceInput, runWorkspaceAction } from '@/lib/collaboration-workspace'

// Takip alanı işlemleri. Yetki kontrolü ortak kodda: kullanıcı kaydın tarafı değilse veya işlem rolüne/duruma uymuyorsa reddedilir.
export async function workspaceAction(
  collaborationId: string,
  input: unknown,
): Promise<{ success: true; error?: undefined; message?: string } | { success?: undefined; error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }

  const parsed = parseWorkspaceInput(input)
  if (!parsed) return { error: 'Geçersiz istek.' }

  const result = await runWorkspaceAction(user.id, typeof collaborationId === 'string' ? collaborationId : '', parsed)
  if (result.success) {
    revalidatePath('/dashboard/collaborations')
    revalidatePath(`/dashboard/collaborations/${collaborationId}`)
  }
  return result
}
