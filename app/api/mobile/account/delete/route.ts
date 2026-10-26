import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deleteAccountCompletely, verifyAccountPassword } from '@/lib/account-deletion'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Uygulama içinden hesap silme (App Store / Google Play uygulama içi silme şartı; KVKK silme hakkı).
 * Web ayarlarıyla aynı kural: şifre tekrar doğrulanır, silme lib/account-deletion.ts ile (kilit → dosyalar → profil → giriş kaydı).
 * Gövde: { password }
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)
  if (!ctx.user.email) return mobileJson({ success: false, error: 'Hesap e-postası bulunamadı. Destek ile iletişime geçin.' }, 400)

  const body = await request.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password) return mobileJson({ success: false, error: 'Şifreni gir.' }, 400)
  if (!(await verifyAccountPassword(ctx.user.email, password))) {
    return mobileJson({ success: false, error: 'Şifre yanlış.' }, 400)
  }

  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ success: false, error: 'Sistem yapılandırma hatası.' }, 500)

  const result = await deleteAccountCompletely(admin, ctx.user.id)
  if (!result.ok) return mobileJson({ success: false, error: result.error }, 400)
  return mobileJson({ success: true })
}
