import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getCollaborationWorkspace, parseWorkspaceInput, runWorkspaceAction } from '@/lib/collaboration-workspace'

export const dynamic = 'force-dynamic'

/** İş birliği takip alanı: anlaşma özeti, teslimatlar, taslak geçmişi, ödeme (RLS'li istemci: yalnızca taraflar). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const result = await getCollaborationWorkspace(ctx.supabase, ctx.user.id, params.id)
  if (!result.success) return mobileJson({ error: result.error }, 404)
  return mobileJson({ workspace: result.workspace })
}

/**
 * Takip alanı işlemi. Gövde: { action, agreement?, version?, deliverableId?, url?, note?, date? }
 * action: save_agreement | confirm_agreement | submit_draft | approve_draft | request_revision | publish_deliverable |
 *         mark_paid | unmark_paid | confirm_payment | unconfirm_payment | report_nonpayment
 * Yetki ortak kodda (lib/collaboration-workspace.ts): yalnızca kaydın tarafı, rolüne ve duruma uygun işlemi yapabilir.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const input = parseWorkspaceInput(await request.json().catch(() => null))
  if (!input) return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result = await runWorkspaceAction(ctx.user.id, params.id, input)
  return mobileJson(result, result.success ? 200 : 400)
}
