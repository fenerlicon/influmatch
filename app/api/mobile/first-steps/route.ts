import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getFirstStepsStatus } from '@/lib/first-steps'

export const dynamic = 'force-dynamic'

/** "İlk adımlar" kontrol listesi durumu (web paneliyle aynı hesap: lib/first-steps.ts). Rol dışıysa { status: null }. */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const status = await getFirstStepsStatus(ctx.supabase, ctx.user.id)
  return mobileJson({ status })
}
