'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { parseWorkspaceInput, runWorkspaceAction } from '@/lib/collaboration-workspace'
import { refreshDeliverableMetricsAs } from '@/lib/post-metrics'

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

// Sonuç raporu "Şimdi güncelle" (3.20): yalnızca iş birliğinin markası, teslimat başına 6 saatte bir (kilit veritabanında).
export async function refreshMetricsAction(
  collaborationId: string,
  deliverableId: string,
): Promise<{ success: true; error?: undefined; message: string } | { success?: undefined; error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }

  const id = typeof collaborationId === 'string' ? collaborationId : ''
  const result = await refreshDeliverableMetricsAs(supabase, user.id, id, typeof deliverableId === 'string' ? deliverableId : '')
  if (result.success) revalidatePath(`/dashboard/collaborations/${id}`)
  return result
}
