import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { dataExportFileName, exportUserData } from '@/lib/data-export'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * "Verilerimi indir" (mobil, Bearer). Web /api/account/export ile aynı kod ve hız sınırı (lib/data-export.ts).
 * Yanıt: { fileName, data } — uygulama paylaşım penceresiyle kaydettirir.
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ error: 'Sistem yapılandırma hatası.' }, 500)

  const result = await exportUserData(admin, ctx.user)
  if ('retryAfterMinutes' in result) {
    return mobileJson({ error: `Verilerini kısa süre önce indirdin. ${result.retryAfterMinutes} dakika sonra tekrar deneyebilirsin.` }, 429)
  }
  return new Response(JSON.stringify({ fileName: dataExportFileName(), data: result.data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
