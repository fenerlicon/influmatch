'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { decideDisputeAsAdmin, proofUrlFor, type AdminDisputeDecision } from '@/lib/collaboration-disputes'
import { createRecordToken } from '@/lib/collaboration-record'
import { logPrivacyAccess } from '@/lib/privacy-audit'

type Result = { success: true; message?: string; url?: string } | { success: false; error: string }

// Anlaşmazlıklar (admin, 2026-11-23). Rol DB'den kontrol edilir; tablolar yalnızca service role ile okunur / yazılır.
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

export async function decideDispute(
  disputeId: string,
  decision: AdminDisputeDecision,
  input: { reason?: { code: string; text: string } | null; note?: string },
): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await decideDisputeAsAdmin(ctx.admin, ctx.userId, disputeId, decision, input ?? {})
  if (!result.success) return { success: false, error: result.error }
  revalidatePath('/admin/disputes')
  revalidatePath('/admin/appeals')
  return { success: true, message: result.message }
}

export async function getDisputeProof(disputeId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await proofUrlFor(ctx.userId, disputeId, { isAdmin: true })
  if (!result.success) return { success: false, error: result.error }
  await logPrivacyAccess(ctx.admin, { actorId: ctx.userId, action: 'payment_proof_view', resourceId: disputeId })
  return { success: true, url: result.url }
}

/** Admin için iş birliği kaydı bağlantısı (çerez oturumu da yeterli; imzalı bağlantı yeni sekmede sorunsuz açılsın diye). */
export async function getRecordLink(collaborationId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const token = createRecordToken(ctx.userId, collaborationId)
  return { success: true, url: `/api/collaborations/${collaborationId}/record${token ? `?t=${encodeURIComponent(token)}` : ''}` }
}
