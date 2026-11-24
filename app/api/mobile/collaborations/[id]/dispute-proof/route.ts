import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createClaimProofUploadUrlAs, createProofUploadUrlAs, proofUrlFor } from '@/lib/collaboration-disputes'
import { logPrivacyAccess } from '@/lib/privacy-audit'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Anlaşmazlık kanıtı (dekont / teslim kanıtı). Gövde:
 *   { action: 'upload-url', disputeId, extension }  → { path, token, bucket } (uploadToSignedUrl ile yüklenir, sonra
 *     /api/mobile/collaborations/[id] POST { action: 'dispute_respond', disputeId, proofPath, note })
 *   { action: 'view', disputeId } → { url } (10 dakika geçerli; yalnızca taraflar)
 *   { action: 'claim-upload-url', extension } → { path, token, bucket }: marka dekontu (2026-11-24), sonra
 *     /api/mobile/collaborations/[id] POST { action: 'claim_payment', proofPath, note }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = (await request.json().catch(() => null)) as { action?: unknown; disputeId?: unknown; extension?: unknown } | null
  if (body?.action === 'upload-url') {
    const result = await createProofUploadUrlAs(ctx.user.id, params.id, body.disputeId, body.extension)
    return mobileJson(result, result.success ? 200 : 400)
  }
  if (body?.action === 'claim-upload-url') {
    const result = await createClaimProofUploadUrlAs(ctx.user.id, params.id, body.extension)
    return mobileJson(result, result.success ? 200 : 400)
  }
  if (body?.action === 'view') {
    const result = await proofUrlFor(ctx.user.id, body.disputeId)
    if (result.success) await logPrivacyAccess(createSupabaseAdminClient(), { actorId: ctx.user.id, action: 'payment_proof_view', resourceId: String(body.disputeId) })
    return mobileJson(result, result.success ? 200 : 404)
  }
  return mobileJson({ error: 'Geçersiz istek.' }, 400)
}
