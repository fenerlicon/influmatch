import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { MODERATION_SUBJECT_TYPES, createAppealUploadUrlAs, loadUserDecisions, submitAppealAs, type ModerationSubjectType } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

/**
 * Kullanıcının kendi ret kararları + itiraz durumu (2026-10-26): { available, decisions }. Kurallar web ile aynı (lib/moderation.ts).
 * ?type=account|tax_document|task_submission (isteğe bağlı), ?ids=<kayıt kimlikleri, virgülle> (isteğe bağlı).
 * Reddedilmiş hesap da oturum token'ıyla çağırabilir (ret ekranındaki itiraz).
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const url = new URL(request.url)
  const typeParam = url.searchParams.get('type')
  const subjectType = (MODERATION_SUBJECT_TYPES as readonly string[]).includes(typeParam ?? '') ? (typeParam as ModerationSubjectType) : undefined
  const idsParam = url.searchParams.get('ids')
  const subjectIds = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100) : undefined
  const result = await loadUserDecisions(createSupabaseAdminClient(), ctx.user.id, { subjectType, subjectIds, limit: subjectType ? 20 : 50 })
  return mobileJson({ success: true, ...result })
}

/** Gövde: { action: 'submit', decisionId, message, attachmentPath? } ya da { action: 'upload-url', extension } (appeal-files kovasına imzalı adres). */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  if (body.action === 'upload-url') {
    const result = await createAppealUploadUrlAs(createSupabaseAdminClient(), ctx.user.id, body.extension)
    return mobileJson(result, result.success ? 200 : 400)
  }
  if (body.action === 'submit') {
    const result = await submitAppealAs(createSupabaseAdminClient(), ctx.user.id, {
      decisionId: body.decisionId,
      message: body.message,
      attachmentPath: body.attachmentPath,
    })
    return mobileJson(result, result.success ? 200 : 400)
  }
  return mobileJson({ error: 'Geçersiz işlem.' }, 400)
}
