'use server'

import { cookies, headers } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import {
  RESET_REQUEST_COOKIE,
  RESET_REQUEST_MAX_AGE,
  recoveryCookieOptions,
  requestBaseUrl,
} from '@/lib/password-recovery'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function requestPasswordReset(rawEmail: string): Promise<{ success: boolean; error?: string }> {
  const email = (rawEmail ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) {
    return { success: false, error: 'Lütfen geçerli bir e-posta adresi girin.' }
  }

  // Server Action istemcisi PKCE doğrulayıcısını çereze yazar (createSupabaseServerClient çerez
  // yazamaz); bu yüzden bağlantı aynı tarayıcıda açılmalıdır.
  const supabase = createServerActionClient({ cookies })
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${requestBaseUrl(headers().get('x-forwarded-host') ?? headers().get('host'), headers().get('x-forwarded-proto'))}/auth/callback`,
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (error.status === 429 || message.includes('rate limit') || message.includes('security purposes')) {
      return { success: false, error: 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.' }
    }
    // Diğer hatalar (ör. kayıtlı olmayan adres) kullanıcıya yansıtılmaz: hangi adreslerin kayıtlı
    // olduğu bu formdan öğrenilememeli.
    console.error('[forgot-password] resetPasswordForEmail hatası:', error.message)
  }

  cookies().set(RESET_REQUEST_COOKIE, '1', recoveryCookieOptions(RESET_REQUEST_MAX_AGE))
  return { success: true }
}
