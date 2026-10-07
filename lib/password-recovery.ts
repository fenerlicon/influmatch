// Şifre sıfırlama akışının paylaşılan sabitleri (yalnızca sunucu).
//
// Akış: /forgot-password → Supabase sıfırlama e-postası → /auth/callback (kod değişimi)
// → /auth/update-password. PKCE kodu, kayıt doğrulama koduyla aynı şekilde geldiği için
// callback hangisi olduğunu talep anında bırakılan RESET_REQUEST_COOKIE ile anlar.
// Kod değişiminden sonra RECOVERY_COOKIE kullanıcı kimliğini taşır; şifre ancak bu çerez
// oturumdaki kullanıcıyla eşleşirse eski şifre sorulmadan değiştirilebilir.

export const RESET_REQUEST_COOKIE = 'im_pw_reset_req'
export const RECOVERY_COOKIE = 'im_pw_recovery'

export const RESET_REQUEST_MAX_AGE = 60 * 60 // e-postadaki bağlantı 1 saat geçerli
export const RECOVERY_MAX_AGE = 15 * 60 // yeni şifreyi belirlemek için 15 dakika

export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/$/, '')
}

export const recoveryCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
})
