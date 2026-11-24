'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { parseWorkspaceInput, runWorkspaceAction } from '@/lib/collaboration-workspace'
import { refreshDeliverableMetricsAs } from '@/lib/post-metrics'
import { createDeliverableUploadAs, deliverableFileUrlAs } from '@/lib/deliverable-files'

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

// Taslak dosyası (R2, teslim kilidi; lib/deliverable-files.ts): yükleme adresi yalnızca influencer'a, anlaşma onaylıyken.
export async function deliverableUploadAction(collaborationId: string, deliverableId: string, extension: string, size: number) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }
  return createDeliverableUploadAs(user.id, String(collaborationId), String(deliverableId), String(extension), Number(size))
}

// Taslak dosyasını önizleme (iki taraf) ya da indirme (marka için ödeme teyidinden sonra).
export async function deliverableFileAction(collaborationId: string, ref: string, mode: 'view' | 'download') {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }
  return deliverableFileUrlAs(user.id, String(collaborationId), String(ref), mode === 'download' ? 'download' : 'view')
}
