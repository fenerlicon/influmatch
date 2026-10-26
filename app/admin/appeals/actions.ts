'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { appealAttachmentUrl, resolveAppealAsAdmin } from '@/lib/moderation'

type Result = { success: true; message?: string; url?: string } | { success: false; error: string }

// İtirazlar (admin, 2026-10-26). Rol DB'den kontrol edilir; tablolar yalnızca service role ile okunur/yazılır.
async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' as const }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.' as const }
  return { admin, userId: user.id }
}

export async function resolveAppeal(appealId: string, action: 'accept' | 'reject', response: string): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await resolveAppealAsAdmin(ctx.admin, ctx.userId, appealId, action, response)
  if (!result.success) return result
  revalidatePath('/admin/appeals')
  revalidatePath('/admin')
  revalidatePath('/admin/tasks')
  return { success: true, message: result.message }
}

export async function getAppealAttachment(appealId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await appealAttachmentUrl(ctx.admin, appealId)
  return result.success ? { success: true, url: result.url } : result
}
