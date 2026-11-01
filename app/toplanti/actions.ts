'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getViewer } from '@/lib/viewer-role'
import {
  CONTENT_PLAN_OWNER_ID,
  createContentCoverUpload,
  deleteContentItem,
  deleteContentSeries,
  saveContentItem,
  saveContentSeries,
} from '@/lib/content-plan'
import type { ContentItemInput, ContentPlanResult, ContentSeriesInput } from '@/lib/content-plan-shared'

// Yazma yalnızca plan sahibine açık (adminler salt okunur takip eder); kimlik her eylemde sunucuda doğrulanır.
async function requireOwner() {
  const viewer = await getViewer()
  if (viewer?.user.id !== CONTENT_PLAN_OWNER_ID) return { error: 'Bu işlem için yetkiniz yok.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.' }
  return { admin }
}

function refreshed(result: ContentPlanResult): ContentPlanResult {
  if (result.success) {
    revalidatePath('/toplanti')
    revalidatePath('/admin/icerik-plani')
  }
  return result
}

export async function saveItem(id: string | null, input: ContentItemInput): Promise<ContentPlanResult> {
  const ctx = await requireOwner()
  if (!ctx.admin) return { success: false, error: ctx.error }
  return refreshed(await saveContentItem(ctx.admin, id, input))
}

export async function createCoverUpload(contentType: string) {
  const ctx = await requireOwner()
  if (!ctx.admin) return { success: false as const, error: ctx.error as string }
  return createContentCoverUpload(ctx.admin, contentType)
}

export async function removeItem(id: string): Promise<ContentPlanResult> {
  const ctx = await requireOwner()
  if (!ctx.admin) return { success: false, error: ctx.error }
  return refreshed(await deleteContentItem(ctx.admin, id))
}

export async function saveSeries(id: string | null, input: ContentSeriesInput, episodeTitles: string[], intervalDays: number): Promise<ContentPlanResult> {
  const ctx = await requireOwner()
  if (!ctx.admin) return { success: false, error: ctx.error }
  return refreshed(await saveContentSeries(ctx.admin, id, input, episodeTitles, intervalDays))
}

export async function removeSeries(id: string): Promise<ContentPlanResult> {
  const ctx = await requireOwner()
  if (!ctx.admin) return { success: false, error: ctx.error }
  return refreshed(await deleteContentSeries(ctx.admin, id))
}
