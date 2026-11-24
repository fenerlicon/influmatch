import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createDeliverableUploadAs, deliverableFileUrlAs, deliverableFilesEnabled } from '@/lib/deliverable-files'

export const dynamic = 'force-dynamic'

/**
 * Teslimat taslak dosyaları (R2, teslim kilidi; lib/deliverable-files.ts). Web ile aynı kurallar.
 * Gövde:
 *   { action: 'status' } → { enabled }  (dosya yükleme açık mı)
 *   { action: 'upload-url', deliverableId, extension, size } → { uploadUrl, ref, contentType }: dosya uploadUrl'e PUT edilir
 *     (Content-Type aynı), sonra POST /api/mobile/collaborations/[id] { action: 'submit_draft', deliverableId, url: ref, note }.
 *   { action: 'view' | 'download', ref } → { url, kind }  (indirme marka için "Ödeme alındı"dan sonra)
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body.action !== 'string') return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)

  if (body.action === 'status') return mobileJson({ success: true, enabled: deliverableFilesEnabled() })

  if (body.action === 'upload-url') {
    const result = await createDeliverableUploadAs(ctx.user.id, params.id, String(body.deliverableId ?? ''), String(body.extension ?? ''), Number(body.size))
    return mobileJson(result, result.success ? 200 : 400)
  }

  if (body.action === 'view' || body.action === 'download') {
    const result = await deliverableFileUrlAs(ctx.user.id, params.id, String(body.ref ?? ''), body.action)
    return mobileJson(result, result.success ? 200 : 400)
  }

  return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)
}
