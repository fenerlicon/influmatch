import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { dataExportFileName, exportUserData } from '@/lib/data-export'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * "Verilerimi indir" (web, çerez oturumu). POST: başka siteden gelen form isteğinde oturum çerezi (SameSite=Lax) gitmez.
 * Yalnızca oturum sahibinin verisi; kurallar ve hız sınırı lib/data-export.ts'te (mobil uçla ortak).
 */
export async function POST() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Oturum gerekli.' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  if (!admin) return Response.json({ error: 'Sistem yapılandırma hatası.' }, { status: 500 })

  const result = await exportUserData(admin, user)
  if ('retryAfterMinutes' in result) {
    return Response.json(
      { error: `Verilerini kısa süre önce indirdin. ${result.retryAfterMinutes} dakika sonra tekrar deneyebilirsin.` },
      { status: 429 },
    )
  }

  return new Response(JSON.stringify(result.data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${dataExportFileName()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
