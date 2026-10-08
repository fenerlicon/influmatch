import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { createTaxUploadUrlAs, loadBrandVerificationState, saveBrandIdentityAs, submitTaxCertificateAs } from '@/lib/brand-verification'
import { saveCorporateEmail, sendCorporateEmailCode, verifyCorporateEmailCode } from '@/lib/corporate-email-verification'

export const dynamic = 'force-dynamic'
// Vergi levhası PDF'i sunucuda ayrıştırılıyor; varsayılan 10 sn yetmeyebilir.
export const maxDuration = 60

/** Marka doğrulama ekranının durumu: kurumsal kimlik, son vergi levhası sonucu, kurumsal e-posta. */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ error: 'Sistem yapılandırma hatası.' }, 500)
  const state = await loadBrandVerificationState(admin, ctx.user.id)
  if (!state) return mobileJson({ error: 'Profil bulunamadı.' }, 404)
  if (state.role !== 'brand') return mobileJson({ error: 'Bu ekran sadece markalar içindir.' }, 403)
  return mobileJson({ success: true, state })
}

/**
 * Gövde: { action, ... }
 * - identity: { companyLegalName, taxId, taxOffice, taxOfficeCity }
 * - upload-url: { extension }  (pdf/jpg/png/webp; günlük sınır kontrolünden sonra imzalı yükleme adresi: { path, token })
 * - tax: { filePath }  (dosya önce imzalı adresle tax-documents/{uid}/ altına yüklenir)
 * - email: { email }   (kaydeder ve kod gönderir)
 * - resend: {}
 * - confirm: { code }
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ error: 'Sistem yapılandırma hatası.' }, 500)
  const userId = ctx.user.id

  try {
    let result: { success: boolean; error?: string; [key: string]: unknown }
    switch (body.action) {
      case 'identity':
        result = await saveBrandIdentityAs(ctx.supabase, userId, body)
        break
      case 'upload-url':
        result = await createTaxUploadUrlAs(admin, userId, String(body.extension ?? ''))
        break
      case 'tax':
        result = await submitTaxCertificateAs(admin, userId, body.filePath)
        break
      case 'email': {
        const saved = await saveCorporateEmail(admin, userId, String(body.email ?? ''))
        result = !saved.success || saved.message.includes('zaten doğrulanmış') ? saved : await sendCorporateEmailCode(admin, userId)
        break
      }
      case 'resend':
        result = await sendCorporateEmailCode(admin, userId)
        break
      case 'confirm':
        result = await verifyCorporateEmailCode(admin, userId, String(body.code ?? ''))
        break
      default:
        return mobileJson({ error: 'Geçersiz işlem.' }, 400)
    }
    return mobileJson(result.success ? result : { error: result.error ?? 'İşlem başarısız.' }, result.success ? 200 : 400)
  } catch (error) {
    console.error('[mobile/brand-verification]', error)
    return mobileJson({ error: error instanceof Error ? error.message : 'İşlem başarısız.' }, 400)
  }
}
