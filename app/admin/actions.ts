'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { createClient } from '@supabase/supabase-js'
import { fetchInstagramData } from '@/utils/instagram-service'

const ADMIN_EMAIL = 'admin@influmatch.net'

export async function verifyUser(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const { error } = await supabase
    .from('users')
    .update({ verification_status: 'verified' })
    .eq('id', userId)

  if (error) {
    console.error('[verifyUser] Supabase error:', error)
    return { error: `Onaylama hatası: ${error.message}` }
  }

  // Award badges for verification - with error handling
  try {
    const result = await awardBadgesForUser(userId)
    if (result.awarded > 0) {
      console.log(`[verifyUser] ${result.awarded} badge(s) awarded for user ${userId}`)
    } else {
      console.log(`[verifyUser] No badges awarded for user ${userId} (may already have them or conditions not met)`)
    }
  } catch (badgeError) {
    console.error('[verifyUser] Badge awarding error:', badgeError)
    // Don't fail the verification if badge awarding fails, but log it
    return {
      success: true,
      warning: `Kullanıcı onaylandı ancak rozet verme hatası: ${badgeError instanceof Error ? badgeError.message : 'Bilinmeyen hata'}`
    }
  }

  revalidatePath('/admin')
  revalidatePath(`/dashboard/influencer/badges`)
  revalidatePath(`/dashboard/brand/badges`)
  revalidatePath(`/dashboard/influencer`)
  revalidatePath(`/dashboard/brand`)
  return { success: true }
}

export async function rejectUser(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const { error } = await supabase
    .from('users')
    .update({ verification_status: 'rejected' })
    .eq('id', userId)

  if (error) {
    console.error('[rejectUser] Supabase error:', error)
    return { error: `Reddetme hatası: ${error.message}` }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function updateAdminNotes(userId: string, notes: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const { error } = await supabase
    .from('users')
    .update({ admin_notes: notes || null })
    .eq('id', userId)

  if (error) {
    return { error: `Not güncelleme hatası: ${error.message}` }
  }

  revalidatePath('/admin')
  return { success: true }
}

// Manual badge awarding function for admins
export async function manuallyAwardBadges(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  try {
    const result = await awardBadgesForUser(userId)
    revalidatePath('/admin')
    revalidatePath(`/dashboard/influencer/badges`)
    revalidatePath(`/dashboard/brand/badges`)

    if (result.error) {
      return { error: result.error }
    }

    if (result.awarded > 0) {
      return { success: true, message: `${result.awarded} rozet verildi.` }
    } else {
      return { success: true, message: 'Verilecek yeni rozet bulunamadı. Kullanıcı zaten tüm rozetlere sahip olabilir veya koşullar karşılanmamış olabilir.' }
    }
  } catch (error: any) {
    console.error('[manuallyAwardBadges] Error:', error)
    return { error: error.message || 'Rozet verme hatası. Lütfen SQL migration\'ı çalıştırdığınızdan emin olun.' }
  }
}

// Manual badge awarding for specific badge ID
export async function manuallyAwardSpecificBadge(userId: string, badgeId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  if (!badgeId || badgeId.trim() === '') {
    return { error: 'Rozet ID\'si gereklidir.' }
  }

  try {
    // Use SQL function to award badge
    const { error: rpcError } = await supabase.rpc('award_user_badge', {
      target_user_id: userId,
      badge_id_to_award: badgeId.trim(),
    })

    if (rpcError) {
      console.error('[manuallyAwardSpecificBadge] RPC error:', rpcError)
      return { error: `Rozet verme hatası: ${rpcError.message}` }
    }

    revalidatePath('/admin')
    revalidatePath(`/dashboard/influencer/badges`)
    revalidatePath(`/dashboard/brand/badges`)

    return { success: true, message: `Rozet "${badgeId}" başarıyla verildi.` }
  } catch (error: any) {
    console.error('[manuallyAwardSpecificBadge] Error:', error)
    return { error: error.message || 'Rozet verme hatası.' }
  }
}

// Toggle spotlight for a user (admin only)
export async function toggleUserSpotlight(
  userId: string,
  spotlightActive: boolean,
  plan: 'ibasic' | 'ipro' | 'mbasic' | 'mpro' | null = null,
  durationMonths: number = 0
) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const updateData: any = { spotlight_active: spotlightActive }

  if (spotlightActive) {
    updateData.spotlight_plan = plan

    // Set expiration
    if (durationMonths > 0) {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths)
      updateData.spotlight_expires_at = expiresAt.toISOString()
    }
  } else {
    updateData.spotlight_plan = null
    updateData.spotlight_expires_at = null
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)

  if (error) {
    console.error('[toggleUserSpotlight] Supabase error:', error)
    return { error: `Spotlight güncelleme hatası: ${error.message}` }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard/influencer')
  revalidatePath('/vitrin')

  return { success: true, message: spotlightActive ? `Spotlight (${plan}, ${durationMonths} ay) aktif edildi.` : 'Spotlight deaktif edildi.' }
}

// Verify tax ID for a brand (admin only)
export async function verifyTaxId(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Check if user has tax_id
  const { data: userProfile } = await supabase
    .from('users')
    .select('tax_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!userProfile) {
    return { error: 'Kullanıcı bulunamadı.' }
  }

  if (!userProfile.tax_id) {
    return { error: 'Bu kullanıcının vergi numarası bulunmuyor.' }
  }

  if (userProfile.role !== 'brand') {
    return { error: 'Bu işlem sadece markalar için geçerlidir.' }
  }

  // Update tax_id_verified
  const { error: updateError } = await supabase
    .from('users')
    .update({ tax_id_verified: true })
    .eq('id', userId)

  if (updateError) {
    console.error('[verifyTaxId] Supabase error:', updateError)
    return { error: `Vergi numarası onaylama hatası: ${updateError.message}` }
  }

  // Award official-business badge
  try {
    const { error: rpcError } = await supabase.rpc('award_user_badge', {
      target_user_id: userId,
      badge_id_to_award: 'official-business',
    })

    if (rpcError) {
      console.error('[verifyTaxId] Badge awarding error:', rpcError)
      // Don't fail if badge awarding fails, but log it
      return {
        success: true,
        warning: `Vergi numarası onaylandı ancak rozet verme hatası: ${rpcError.message}`
      }
    }
  } catch (badgeError) {
    console.error('[verifyTaxId] Badge awarding exception:', badgeError)
    return {
      success: true,
      warning: `Vergi numarası onaylandı ancak rozet verme hatası: ${badgeError instanceof Error ? badgeError.message : 'Bilinmeyen hata'}`
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard/brand/badges')
  revalidatePath('/dashboard/brand')

  return { success: true, message: 'Vergi numarası onaylandı ve "Resmi İşletme" rozeti verildi.' }
}

// Resend verification email to a user (admin only)
export async function resendVerificationEmail(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Get target user email
  const { data: targetUser, error: fetchError } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  if (fetchError || !targetUser?.email) {
    return { error: 'Kullanıcı veya email adresi bulunamadı.' }
  }

  // Use admin client to resend verification email
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı (Service Role Key eksik olabilir).' }
  }

  // Resend signup verification email
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const { error } = await supabaseAdmin.auth.resend({
    type: 'signup',
    email: targetUser.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`
    }
  })

  if (error) {
    console.error('[resendVerificationEmail] Error:', error)
    if (error.message.includes('Error sending confirmation email')) {
      return { error: 'E-posta gönderim limiti aşıldı (Rate Limit). Lütfen 1 saat bekleyip tekrar deneyin.' }
    }
    return { error: `E-posta gönderme hatası: ${error.message}` }
  }

  return { success: true, message: 'Doğrulama e-postası gönderildi.' }
}

// Manually verify user's email (Bypass email sending)
export async function forceVerifyEmail(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Use admin client
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı.' }
  }

  try {
    // Determine the email confirm update based on Supabase API version
    // Usually updateUserById with email_confirm: true works for confirming email
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: { email_verified: true } // Helper metadata
    })

    if (error) {
      console.error('[forceVerifyEmail] Auth update error:', error)
      return { error: `Auth güncelleme hatası: ${error.message}` }
    }

    // Also update public.users if needed (though triggers usually handle it)
    await supabase.from('users').update({ email_verified_at: new Date().toISOString() }).eq('id', userId)

    revalidatePath('/admin')
    return { success: true, message: 'Kullanıcı e-postası manuel olarak onaylandı.' }
  } catch (error: any) {
    console.error('[forceVerifyEmail] Error:', error)
    return { error: error.message || 'Bir hata oluştu.' }
  }
}

// Reset all "verified-account" badges (Danger Zone)
export async function resetVerifiedBadges() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing')
    return { error: 'Sistem hatası: Service Role Key eksik.' }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    const { error, count } = await adminClient
      .from('user_badges')
      .delete({ count: 'exact' })
      .eq('badge_id', 'verified-account')

    if (error) {
      throw error
    }

    revalidatePath('/admin')
    revalidatePath(`/dashboard/influencer/badges`)
    revalidatePath(`/dashboard/brand/badges`)
    return { success: true, message: `Toplam ${count ?? 'bilinmeyen sayıda'} kullanıcının mavi tiki silindi.` }
  } catch (error: any) {
    console.error('[resetVerifiedBadges] Error:', error)
    return { error: error.message || 'Sıfırlama işlemi sırasında hata oluştu.' }
  }
}

// Toggle "verified-account" (Blue Tick) or "official-business" (Gold Tick) badge based on role
export async function toggleBlueTick(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  try {
    // Get target user role to determine which badge to toggle
    const { data: targetUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return { error: 'Kullanıcı bulunamadı.' }
    }

    const badgeId = targetUser.role === 'brand' ? 'official-business' : 'verified-account'
    const badgeName = targetUser.role === 'brand' ? 'Resmi İşletme (Sarı Tik)' : 'Onaylı Hesap (Mavi Tik)'

    // Check if user has the badge
    const { data: existingBadge } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', badgeId)
      .maybeSingle()

    let action = ''
    let message = ''

    if (existingBadge) {
      // Remove badge
      const { error: deleteError } = await supabase
        .from('user_badges')
        .delete()
        .eq('user_id', userId)
        .eq('badge_id', badgeId)

      if (deleteError) {
        throw deleteError
      }
      action = 'removed'
      message = `${badgeName} kaldırıldı.`
    } else {
      // Add badge
      const { error: insertError } = await supabase
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badgeId,
          earned_at: new Date().toISOString()
        })

      if (insertError) {
        throw insertError
      }
      action = 'added'
      message = `${badgeName} verildi.`
    }

    // IMPORTANT: Sync displayed_badges in users table
    // Fetch all current badges for the user
    const { data: allBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)

    const badgeArray = allBadges?.map((b) => b.badge_id).filter(Boolean) || []

    // Update users table using Admin Client to bypass RLS
    const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
    const supabaseAdmin = createSupabaseAdminClient()

    if (supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ displayed_badges: badgeArray })
        .eq('id', userId)

      if (updateError) {
        console.error('[toggleBlueTick] Admin update error:', updateError)
        // Fallback to normal client just in case
        await supabase
          .from('users')
          .update({ displayed_badges: badgeArray })
          .eq('id', userId)
      }
    } else {
      // Fallback if admin client init fails
      console.warn('[toggleBlueTick] Admin client init failed, using standard client')
      await supabase
        .from('users')
        .update({ displayed_badges: badgeArray })
        .eq('id', userId)
    }

    revalidatePath('/admin')
    revalidatePath(`/dashboard/influencer/badges`)
    revalidatePath(`/dashboard/brand/badges`)
    revalidatePath('/dashboard/messages') // Revalidate messages as well

    return { success: true, message, action }
  } catch (error: any) {
    console.error('[toggleBlueTick] Error:', error)
    return { error: error.message || 'İşlem sırasında bir hata oluştu.' }
  }
}

// Delete a user completely (Admin only)
export async function deleteUser(userId: string) {
  console.log('[deleteUser] Starting deletion for userId:', userId)
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.warn('[deleteUser] No authenticated user')
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    console.warn('[deleteUser] Unauthorized attempt by:', user.email)
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Use admin client to delete user from Auth (which should cascade to public.users)
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    console.error('[deleteUser] Service Role Key missing or invalid')
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı.' }
  }

  try {
    // 1. Explicitly delete from public.users first (to prevent "zombie" users if cascade fails)
    console.log('[deleteUser] Deleting from public.users...')
    const { error: publicDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (publicDeleteError) {
      console.error('[deleteUser] Public table delete error:', publicDeleteError)
    } else {
      console.log('[deleteUser] Deleted from public.users')
    }

    // 2. Delete from Auth (source of truth)
    console.log('[deleteUser] Deleting from auth.users...')
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('[deleteUser] Supabase Auth Delete Error:', authDeleteError)

      // If error is "User not found", it means they are already gone from Auth (Zombie user).
      // Since we just ran the public delete above, treat it as success or just proceed.
      // But we must return success if they are now gone.
      if (authDeleteError.message?.includes('User not found')) {
        console.log('[deleteUser] User already missing from Auth (Zombie), continuing...')
      } else {
        return { error: `Auth silme hatası: ${authDeleteError.message}` }
      }
    }

    console.log('[deleteUser] User deleted successfully from Auth')

    revalidatePath('/admin')
    revalidatePath('/dashboard/influencer')
    revalidatePath('/dashboard/brand')

    return { success: true, message: 'Kullanıcı ve tüm verileri silindi.' }
  } catch (error: any) {
    console.error('[deleteUser] Exception:', error)
    return { error: error.message || 'Silme işlemi sırasında bir hata oluştu.' }
  }
}

// Update Instagram data (Admin only)
export async function adminUpdateInstagramData(userId: string) {
  const supabase = createSupabaseServerClient()

  try {
    // 0. Security Check: Are we admin?
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return { success: false, error: 'Oturum açmanız gerekiyor.' }
    }

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', authUser.id)
      .maybeSingle()

    const isAdmin = adminProfile?.role === 'admin' || authUser.email === ADMIN_EMAIL

    if (!isAdmin) {
      return { success: false, error: 'Yetkisiz işlem.' }
    }


    // 1. Get the user's social account record
    const { data: account, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .single()

    if (fetchError || !account) {
      return { success: false, error: 'Kullanıcının bağlı Instagram hesabı bulunamadı.' }
    }

    const username = account.username
    const verificationCode = account.verification_code
    // 2. FETCH DATA using Service (StarAPI -> RocketAPI Fallback)
    let normalizedData;
    try {
      normalizedData = await fetchInstagramData(username);
    } catch (apiError: any) {
      console.error('Instagram Service Error:', apiError)

      if (apiError.message && apiError.message.includes('API Restriction')) {
        // If it's the restriction error, return specific error for admin
        return {
          success: false,
          error: `UYARI: Kullanıcının gönderileri var ancak API içerikleri çekemedi (Instagram Kısıtlaması). İstatistikler GÜNCELLENMEDİ.`
        }
      }

      // DEBUG: Check if RocketAPI key is present to help user diagnose
      const hasRocketKey = !!process.env.ROCKETAPI_KEY;
      const debugInfo = hasRocketKey ? 'RocketAPI Key: VAR' : 'RocketAPI Key: YOK';

      return { success: false, error: `Veri çekme hatası: ${apiError.message} (${debugInfo})` }
    }

    const user = normalizedData.user
    const edges = normalizedData.recent_posts

    // DEBUG LOG
    console.log(`[adminUpdateInstagramData] Data fetched for ${username}. UserID: ${user.id}, PostCount (API): ${user.media_count}, Edges fetched: ${edges.length}`)
    if (edges.length > 0) {
      console.log(`[adminUpdateInstagramData] Sample Edge:`, JSON.stringify(edges[0].node, null, 2))
    }

    const biography = user.biography || ''
    const platformUserId = user.id
    const followerCount = user.follower_count
    const followingCount = user.following_count
    const postCount = user.media_count
    const isVerified = user.is_verified
    const categoryName = user.category_name
    const isBusinessAccount = user.is_business_account
    const externalUrl = user.external_url

    // Note: Admin update bypasses verification code check since the account is already linked
    // We assume the admin verified the link is correct or just wants to refresh stats.

    // Calculate Stats from Timeline Media
    let avgLikes = 0
    let avgComments = 0
    let avgViews = 0
    let engagementRate = 0
    let averageIntervalDays = 0

    // 3. Stats Calculation Logic
    const recentPosts = edges.slice(0, 12).map((edge: any) => edge.node)


    if (recentPosts.length > 0) {
      const totalLikes = recentPosts.reduce((sum: number, post: any) => sum + (post.edge_liked_by?.count || 0), 0)
      const totalComments = recentPosts.reduce((sum: number, post: any) => sum + (post.edge_media_to_comment?.count || 0), 0)

      // Calculate views for video posts
      const videoPosts = recentPosts.filter((post: any) => post.is_video)
      if (videoPosts.length > 0) {
        const totalViews = videoPosts.reduce((sum: number, post: any) => sum + (Number(post.video_view_count) || 0), 0)
        avgViews = Math.round(totalViews / videoPosts.length)
        console.log(`[adminUpdate] Video Stats: ${videoPosts.length} videos found. Total Views: ${totalViews}, Avg Views: ${avgViews}`)
      } else {
        console.log('[adminUpdate] No video posts found for view calculation.')
      }

      avgLikes = Math.round(totalLikes / recentPosts.length)
      avgComments = Math.round(totalComments / recentPosts.length)

      if (followerCount > 0) {
        engagementRate = parseFloat((((avgLikes + avgComments) / followerCount) * 100).toFixed(2))
      }

      // Calculate Posting Frequency (Average days between posts)
      if (recentPosts.length > 1) {
        const sortedPosts = [...recentPosts].sort((a: any, b: any) => b.taken_at_timestamp - a.taken_at_timestamp)
        const newestDate = sortedPosts[0].taken_at_timestamp
        const oldestDate = sortedPosts[sortedPosts.length - 1].taken_at_timestamp
        const diffSeconds = newestDate - oldestDate
        const diffDays = diffSeconds / (60 * 60 * 24)
        averageIntervalDays = Math.round(diffDays / (sortedPosts.length - 1))
      }
    }

    // 4. Update Database
    const statsPayload = {
      avg_likes: avgLikes,
      avg_comments: avgComments,
      avg_views: avgViews,
      following_count: followingCount,
      post_count: postCount,
      is_verified: isVerified,
      category_name: categoryName,
      is_business_account: isBusinessAccount,
      external_url: externalUrl,
      posting_frequency: averageIntervalDays
    }

    const now = new Date().toISOString()

    // Use ADMIN CLIENT to bypass RLS policies for updating another user's data
    const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
    const supabaseAdmin = createSupabaseAdminClient()

    if (!supabaseAdmin) {
      console.error('[adminUpdateInstagramData] Service Role Key missing')
      return { success: false, error: 'Sistem hatası: Admin yetkisi alınamadı.' }
    }

    const { error: updateError } = await supabaseAdmin
      .from('social_accounts')
      .update({
        is_verified: true,
        platform_user_id: platformUserId,
        follower_count: followerCount,
        engagement_rate: engagementRate,
        has_stats: true,
        stats_payload: statsPayload,
        last_scraped_at: now,
        updated_at: now // Explicitly update updated_at
      })
      .eq('id', account.id)

    if (updateError) {
      console.error('Error updating verification status:', updateError)
      return { success: false, error: 'Güncelleme hatası.' }
    }

    // Award verified badge if not present? Maybe not, keep that for explicit approval.
    // But if they are being updated, it implies they are verified.
    // Let's stick to just updating stats to be safe.

    revalidatePath('/admin')
    revalidatePath('/dashboard/influencer')

    return {
      success: true,
      message: 'Hesap verileri başarıyla güncellendi.',
      data: {
        platform_user_id: platformUserId,
        follower_count: followerCount,
        engagement_rate: engagementRate,
        ...statsPayload
      }
    }

  } catch (error) {
    console.error('Exception verifying instagram account:', error)
    return { success: false, error: 'Genel hata oluştu.' }
  }
}

// Manually connect/verify an Instagram account for a user (Admin only)
export async function adminManualConnectInstagram(identifier: string, instagramUsername: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', authUser.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || authUser.email === ADMIN_EMAIL

  if (!isAdmin) {
    return { success: false, error: 'Bu işlem için yetkiniz yok.' }
  }

  if (!identifier || !instagramUsername) {
    return { success: false, error: 'Kullanıcı Email/ID ve Instagram kullanıcı adı gereklidir.' }
  }

  // 1. Find Target User
  // Check if identifier is UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)

  let targetUserId = identifier

  if (!isUuid) {
    // Assume email, lookup user
    // We cannot search auth.users directly easily without service role + admin client
    // But we can search public.users if email is there
    const { data: publicUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', identifier)
      .maybeSingle()

    if (publicUser) {
      targetUserId = publicUser.id
    } else {
      // Try Admin Client to find user by email in Auth
      const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
      const supabaseAdmin = createSupabaseAdminClient()
      // Admin client doesn't verify email lookup easily without exact match in `users` list which is paginated
      // It's safer to rely on 'users' table sync. If not found, return error.
      return { success: false, error: 'Kullanıcı bulunamadı (Email public.users tablosunda yok). Lütfen doğrudan User ID (UUID) kullanın.' }
    }
  }

  const now = new Date().toISOString()

  // 1.5 Try to fetch real live data
  let statsData: any = {
    follower_count: 0,
    engagement_rate: 0,
    has_stats: false,
    stats_payload: {
      following_count: 0,
      post_count: 0,
      avg_likes: 0,
      avg_comments: 0
    }
  }

  try {
    // Dynamic import to avoid potential circular dependencies
    const { fetchInstagramData } = await import('@/utils/instagram-service')
    const data = await fetchInstagramData(instagramUsername)
    const user = data.user
    const edges = data.recent_posts || []

    // Calculate Stats
    let avgLikes = 0
    let avgComments = 0
    let avgViews = 0

    if (edges.length > 0) {
      // Sort edges by date (newest first) to correctly handle Pinned Posts
      edges.sort((a: any, b: any) => {
        const timeA = a.node?.taken_at_timestamp || 0
        const timeB = b.node?.taken_at_timestamp || 0
        return timeB - timeA
      })

      const recentPosts = edges.slice(0, 6).map((edge: any) => edge.node)
      const totalLikes = recentPosts.reduce((sum: number, post: any) => sum + (post.edge_liked_by?.count || 0), 0)
      const totalComments = recentPosts.reduce((sum: number, post: any) => sum + (post.edge_media_to_comment?.count || 0), 0)

      const videoPosts = recentPosts.filter((post: any) => post.is_video)
      if (videoPosts.length > 0) {
        const totalViews = videoPosts.reduce((sum: number, post: any) => sum + (post.video_view_count || 0), 0)
        avgViews = Math.round(totalViews / videoPosts.length)
      }
      avgLikes = Math.round(totalLikes / recentPosts.length)
      avgComments = Math.round(totalComments / recentPosts.length)
    }

    let engagementRate = 0
    if (user.follower_count > 0) {
      const rawRate = ((avgLikes + avgComments) / user.follower_count) * 100
      engagementRate = Math.min(parseFloat(rawRate.toFixed(2)), 999.99)
    }

    statsData = {
      follower_count: user.follower_count,
      engagement_rate: engagementRate,
      has_stats: true,
      stats_payload: {
        following_count: user.following_count,
        post_count: user.media_count,
        avg_likes: avgLikes,
        avg_comments: avgComments,
        avg_views: avgViews,
        is_business_account: user.is_business_account || false,
        category_name: user.category_name,
        external_url: user.external_url,
        posting_frequency: 0
      }
    }
  } catch (e) {
    console.warn('[adminManualConnect] Failed to fetch live data (proceeding with empty stats):', e)
  }

  // 2. Upsert Social Account
  // Use Admin Client to bypass RLS
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { success: false, error: 'Admin yetkisi hatası.' }
  }

  const { error: upsertError } = await supabaseAdmin
    .from('social_accounts')
    .upsert(
      {
        user_id: targetUserId,
        platform: 'instagram',
        username: instagramUsername,
        is_verified: true,
        updated_at: now,
        ...statsData
      },
      {
        onConflict: 'user_id, platform'
      }
    )

  if (upsertError) {
    console.error('[adminManualConnectInstagram] Upsert error:', upsertError)
    return { success: false, error: `Veritabanı hatası: ${upsertError.message}` }
  }

  // 3. Award Blue Tick Badge
  try {
    await supabase.rpc('award_user_badge', {
      target_user_id: targetUserId,
      badge_id_to_award: 'verified-account',
    })

    // Sync badge display
    await supabaseAdmin.from('users').update({
      displayed_badges: ['verified-account'] // Basic override/append logic might be better but this ensures it shows up
    }).eq('id', targetUserId)

  } catch (e) {
    console.warn('Badge award failed but account connected:', e)
  }

  revalidatePath('/admin')
  return { success: true, message: `Kullanıcı (${instagramUsername}) başarıyla bağlandı ve onaylandı.` }
}
