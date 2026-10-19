'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import {
  applyPendingRewardsAsAdmin,
  cancelRewardAsAdmin,
  reviewSubmissionAsAdmin,
  saveTaskAsAdmin,
  type TaskInput,
} from '@/lib/tasks'
import { savePromoPeriod } from '@/lib/tasks-promo'
import { sweepBlueTicks } from '@/lib/blue-tick'

type Result = { success: true; message?: string } | { success: false; error: string }

// Görevler (admin). Rol DB'den kontrol edilir; görev tabloları yalnızca service role ile yazılır.
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

const done = (message?: string): Result => {
  revalidatePath('/admin/tasks')
  return { success: true, message }
}

export async function saveTask(id: string | null, input: TaskInput): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await saveTaskAsAdmin(ctx.admin, ctx.userId, id, input && typeof input === 'object' ? input : {})
  return result.success ? done('Görev kaydedildi.') : result
}

export async function reviewSubmission(submissionId: string, decision: 'approve' | 'reject', note: string | null): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  if (decision !== 'approve' && decision !== 'reject') return { success: false, error: 'Geçersiz karar.' }
  const result = await reviewSubmissionAsAdmin(ctx.admin, ctx.userId, submissionId, decision, typeof note === 'string' ? note : null)
  return result.success ? done(decision === 'approve' ? 'Onaylandı; ödül bekleyen ödüllere eklendi.' : 'Reddedildi.') : result
}

export async function cancelReward(rewardId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await cancelRewardAsAdmin(ctx.admin, rewardId)
  return result.success ? done('Ödül iptal edildi.') : result
}

/** Satış başlayınca: bekleyen ödülleri hesaplara işler. */
export async function applyPendingRewards(): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await applyPendingRewardsAsAdmin(ctx.admin)
  if (!result.success) return result
  revalidatePath('/admin')
  return done(`${result.applied} ödül işlendi${result.skipped ? `, ${result.skipped} süresiz planda atlandı` : ''}${result.failed ? `, ${result.failed} hata` : ''}.`)
}

/** 0₺ dönemi bayrağı; değişince mavi tikler hemen yeniden değerlendirilir. */
export async function setPromoPeriod(enabled: boolean): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  if (typeof enabled !== 'boolean') return { success: false, error: 'Geçersiz değer.' }
  try {
    await savePromoPeriod(ctx.admin, ctx.userId, enabled)
  } catch (error) {
    console.error('[admin/tasks] 0₺ dönemi kaydedilemedi:', error)
    return { success: false, error: 'Ayar kaydedilemedi.' }
  }
  try {
    const summary = await sweepBlueTicks(ctx.admin)
    return done(`0₺ dönemi ${enabled ? 'açıldı' : 'kapandı'}. Mavi tik: ${summary.granted} verildi, ${summary.revoked} kaldırıldı.`)
  } catch (error) {
    console.error('[admin/tasks] mavi tik taraması başarısız:', error)
    return done(`0₺ dönemi ${enabled ? 'açıldı' : 'kapandı'}. Mavi tikler bir sonraki saatlik görevde güncellenecek.`)
  }
}
