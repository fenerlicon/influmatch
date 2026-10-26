'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { saveEmailPreferences } from '@/lib/email-preferences'
import { setAvailabilityAs } from '@/lib/availability'

export interface EmailNotificationSettings {
  offers: boolean
  advert_applications: boolean
  messages: boolean
  marketing: boolean
  updates: boolean
}

export async function updateEmailNotifications(
  userId: string,
  settings: EmailNotificationSettings,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseServerClient()
    
    // Verify user owns this account
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user || user.id !== userId) {
      return { success: false, error: 'Yetkisiz erişim' }
    }

    // Ortak kod (lib/email-preferences.ts): yalnızca bilinen anahtarlar yazılır; mobil uç da aynısını kullanır.
    const result = await saveEmailPreferences(supabase, userId, settings)
    if ('error' in result) return { success: false, error: result.error }

    revalidatePath('/dashboard/influencer/settings')
    revalidatePath('/dashboard/brand/settings')
    
    return { success: true }
  } catch (error) {
    console.error('[updateEmailNotifications] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseServerClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user || !user.email) {
      return { success: false, error: 'Oturum açmanız gerekiyor' }
    }

    // Verify current password by attempting to sign in
    // This is necessary to ensure the user knows their current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return { success: false, error: 'Mevcut şifre yanlış' }
    }

    // Re-get user after sign in (session may have refreshed)
    const {
      data: { user: refreshedUser },
    } = await supabase.auth.getUser()

    if (!refreshedUser) {
      return { success: false, error: 'Oturum hatası' }
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      console.error('[changePassword] error:', updateError)
      
      const message = updateError.message.toLowerCase()
      if (message.includes('different from the old')) {
        return { success: false, error: 'Yeni şifre mevcut şifrenizden farklı olmalıdır' }
      }
      if (message.includes('weak') || message.includes('pwned') || message.includes('leaked')) {
        return { success: false, error: 'Bu şifre çok zayıf veya sızdırılmış şifre listelerinde yer alıyor' }
      }
      if (message.includes('at least') || message.includes('too short')) {
        return { success: false, error: 'Yeni şifre en az 6 karakter olmalıdır' }
      }

      return { success: false, error: 'Şifre güncellenemedi. Lütfen tekrar deneyin.' }
    }

    return { success: true }
  } catch (error) {
    console.error('[changePassword] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

export async function deleteAccount(password: string): Promise<{ success: boolean; error?: string; redirect?: string }> {
  try {
    const supabase = createSupabaseServerClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user || !user.email) {
      return { success: false, error: 'Oturum açmanız gerekiyor' }
    }

    // Açık kalmış bir oturumla hesabın silinememesi için şifre tekrar doğrulanır.
    // Doğrulama ayrı, oturum saklamayan bir istemciyle yapılır; mevcut oturum çerezleri değişmez.
    if (!password) {
      return { success: false, error: 'Şifrenizi girin' }
    }
    const { deleteAccountCompletely, verifyAccountPassword } = await import('@/lib/account-deletion')
    if (!(await verifyAccountPassword(user.email, password))) {
      return { success: false, error: 'Şifre yanlış' }
    }

    const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
    const supabaseAdmin = createSupabaseAdminClient()
    if (!supabaseAdmin) {
      return { success: false, error: 'Sistem yapılandırma hatası. Lütfen destek ile iletişime geçin.' }
    }

    const result = await deleteAccountCompletely(supabaseAdmin, user.id)
    if (!result.ok) {
      return { success: false, error: result.error }
    }

    await supabase.auth.signOut()

    return { success: true, redirect: '/login?deleted=true' }
  } catch (error) {
    console.error('[deleteAccount] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}


// Müsaitlik "İş alıyorum / Şu an dolu" (3.19). Kurallar lib/availability.ts'te; mobil /api/mobile/availability aynısını çağırır.
export async function updateAvailability(input: { status: string; note?: string | null; until?: string | null }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturumunuz bulunamadı.' }
  const result = await setAvailabilityAs(supabase, user.id, input)
  if ('success' in result) {
    revalidatePath('/dashboard/influencer/settings')
    revalidatePath('/dashboard/influencer')
  }
  return result
}
