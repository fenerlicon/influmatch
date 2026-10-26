import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { recordConsent, latestConsent } from '@/lib/consent'
import { COOKIE_POLICY_VERSION } from '@/lib/consent-shared'

export const dynamic = 'force-dynamic'

/**
 * Çerez tercihinin kaydı (KVKK Çerez Rehberi: rızanın ispatı). Yalnızca giriş yapmış kullanıcı için yazılır;
 * giriş yapmamış ziyaretçinin tercihi yalnızca kendi tarayıcısındaki çerezde durur, giriş yapınca banner bileşeni bu uca bildirir.
 * Gövde: { kind: 'cookies_optional', granted: boolean }. Aynı tercih zaten son kayıtsa yeni satır yazılmaz.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || body.kind !== 'cookies_optional' || typeof body.granted !== 'boolean') {
    return Response.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ recorded: false })

  const admin = createSupabaseAdminClient()
  if (!admin) return Response.json({ recorded: false })

  const last = await latestConsent(admin, user.id, 'cookies_optional')
  if (last && last.granted === body.granted && last.version === COOKIE_POLICY_VERSION) {
    return Response.json({ recorded: true })
  }
  await recordConsent(admin, { userId: user.id, kind: 'cookies_optional', granted: body.granted, version: COOKIE_POLICY_VERSION, source: 'web' })
  return Response.json({ recorded: true })
}
