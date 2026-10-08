import { mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_MS = 2 * 60 * 1000
const MAX_PER_DAY = 5
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Mobil "şifremi unuttum". Web akışı PKCE doğrulayıcısını tarayıcı çerezinde tuttuğu için bağlantı yalnızca
 * talebi başlatan tarayıcıda çalışır; mobilde talep uygulamadan, bağlantı telefonun tarayıcısında açılır.
 * Bu yüzden kurtarma bağlantısı sunucuda üretilir ve token_hash biçiminde gönderilir: /auth/callback onu her
 * cihazda doğrulayıp web'in yeni şifre ekranına (/auth/update-password) yönlendirir.
 *
 * Gövde: { email }. Hangi adreslerin kayıtlı olduğu öğrenilemesin diye yanıt her zaman başarılıdır.
 * Kötüye kullanım ve e-posta kotası için adres başına 2 dakikada bir, günde en fazla 5 gönderim (aşım da sessiz).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = String(body?.email ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) return mobileJson({ error: 'Lütfen geçerli bir e-posta adresi girin.' }, 400)

  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ error: 'Sistem yapılandırma hatası.' }, 500)

  const ok = mobileJson({ success: true })

  const { data: profile } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (!profile?.id) return ok

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id as string)
  const meta = (authUser?.user?.app_metadata ?? {}) as { recovery_sent_at?: string[] }
  const now = Date.now()
  const recent = (Array.isArray(meta.recovery_sent_at) ? meta.recovery_sent_at : []).filter(
    (t) => now - new Date(t).getTime() < DAY_MS,
  )
  if (recent.length >= MAX_PER_DAY || recent.some((t) => now - new Date(t).getTime() < RESEND_COOLDOWN_MS)) {
    // Sınır aşımı da sessiz: farklı yanıt, adresin kayıtlı olduğunu ele verirdi.
    return ok
  }

  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const tokenHash = link?.properties?.hashed_token
  if (error || !tokenHash) {
    console.error('[mobile/forgot-password] bağlantı üretilemedi:', error?.message)
    return ok
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/+$/, '')
  const url = `${base}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
  const result = await sendEmail({
    to: [email],
    subject: 'Influmatch: Şifre sıfırlama',
    text:
      `Şifrenizi sıfırlamak için aşağıdaki bağlantıyı açın:\n\n${url}\n\n` +
      'Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.',
  })
  if (!result.sent) {
    console.error('[mobile/forgot-password] e-posta gönderilemedi:', result.reason)
    return ok
  }

  await admin.auth.admin.updateUserById(profile.id as string, {
    app_metadata: { ...(authUser?.user?.app_metadata ?? {}), recovery_sent_at: [...recent, new Date(now).toISOString()] },
  })
  return ok
}
