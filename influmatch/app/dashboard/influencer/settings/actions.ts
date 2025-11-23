'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

    const { error } = await supabase
      .from('users')
      .update({ email_notifications: settings })
      .eq('id', userId)

    if (error) {
      console.error('[updateEmailNotifications] error:', error)
      
      // Check if it's a column not found error
      if (error.message?.includes('email_notifications') || error.message?.includes('column') || error.code === '42703') {
        return { 
          success: false, 
          error: 'E-posta bildirimleri özelliği henüz aktif değil. Lütfen daha sonra tekrar deneyin veya destek ekibiyle iletişime geçin.' 
        }
      }
      
      return { success: false, error: error.message || 'Ayarlar kaydedilemedi' }
    }

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
      
      // Check for password strength errors
      if (updateError.message.includes('Password') || updateError.message.includes('password')) {
        return { success: false, error: 'Yeni şifre en az 6 karakter olmalıdır' }
      }
      
      return { success: false, error: updateError.message || 'Şifre güncellenemedi' }
    }

    return { success: true }
  } catch (error) {
    console.error('[changePassword] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

export async function deleteAccount(): Promise<{ success: boolean; error?: string; redirect?: string }> {
  try {
    const supabase = createSupabaseServerClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Oturum açmanız gerekiyor' }
    }

    console.log('[deleteAccount] Attempting to delete user:', user.id)

    // Delete from public.users table (cascade will handle related data)
    const { error: dbDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)

    if (dbDeleteError) {
      console.error('[deleteAccount] db delete error:', dbDeleteError)
      return { success: false, error: `Hesap silinirken bir hata oluştu: ${dbDeleteError.message}` }
    }

    console.log('[deleteAccount] User deleted from public.users table')

    // Sign out the user first
    await supabase.auth.signOut()
    
    // Note: Auth user deletion requires admin privileges
    // The public.users record is deleted, which prevents access to the platform
    // The auth.users record can be manually deleted by admin if needed
    
    return { success: true, redirect: '/login' }
  } catch (error) {
    console.error('[deleteAccount] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}

