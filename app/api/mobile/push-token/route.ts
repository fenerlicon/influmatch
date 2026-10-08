import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/

/**
 * Cihazın push token'ını oturumdaki kullanıcıya bağlar. Gövde: { token } ; token null ise kaydı siler (çıkış).
 * Aynı cihazda hesap değişince eski hesabın bildirimleri yeni kullanıcıya gitmesin diye token başka
 * hesaplardan kaldırılır (bunu yalnızca sunucu yapabilir).
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  const token = body?.token ?? null
  if (token !== null && (typeof token !== 'string' || !EXPO_TOKEN_PATTERN.test(token))) {
    return mobileJson({ error: 'Geçersiz token.' }, 400)
  }

  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ error: 'Sistem yapılandırma hatası.' }, 500)

  if (token) {
    await admin.from('users').update({ push_token: null }).eq('push_token', token).neq('id', ctx.user.id)
  }
  const { error } = await admin.from('users').update({ push_token: token }).eq('id', ctx.user.id)
  if (error) {
    console.error('[mobile/push-token]', error.message)
    return mobileJson({ error: 'Kaydedilemedi.' }, 500)
  }
  return mobileJson({ success: true })
}
