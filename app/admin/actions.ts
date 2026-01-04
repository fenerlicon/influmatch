'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { createClient } from '@supabase/supabase-js'

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
    return { error: `E-posta gönderme hatası: ${error.message}` }
  }

  return { success: true, message: 'Doğrulama e-postası gönderildi.' }
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
