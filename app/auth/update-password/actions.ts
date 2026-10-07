'use server'

import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { RECOVERY_COOKIE } from '@/lib/password-recovery'

export async function completePasswordReset(
  newPassword: string,
  confirmPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return { success: false, error: 'Şifre en az 6 karakter olmalıdır.' }
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Şifreler eşleşmiyor.' }
  }

  // Çerez yazabilen istemci: şifre değişimi ve çıkış oturum çerezlerini günceller.
  const supabase = createServerActionClient({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sıfırlama bağlantısından gelinmediyse (veya 15 dakika geçtiyse) eski şifre sorulmadan değiştirilemez.
  const recoveryUserId = cookies().get(RECOVERY_COOKIE)?.value
  if (!user || !recoveryUserId || recoveryUserId !== user.id) {
    return { success: false, error: 'Sıfırlama bağlantısının süresi doldu. Lütfen yeni bir bağlantı isteyin.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('different from the old')) {
      return { success: false, error: 'Yeni şifre eski şifrenizden farklı olmalıdır.' }
    }
    if (message.includes('weak') || message.includes('pwned') || message.includes('leaked')) {
      return { success: false, error: 'Bu şifre çok zayıf veya sızdırılmış şifre listelerinde yer alıyor. Başka bir şifre seçin.' }
    }
    if (message.includes('at least') || message.includes('too short')) {
      return { success: false, error: 'Şifre çok kısa.' }
    }
    console.error('[update-password] updateUser hatası:', error.message)
    return { success: false, error: 'Şifre güncellenemedi. Lütfen tekrar deneyin.' }
  }

  cookies().delete(RECOVERY_COOKIE)
  await supabase.auth.signOut()
  return { success: true }
}
