'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'

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
export async function toggleUserSpotlight(userId: string, spotlightActive: boolean) {
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
    .update({ spotlight_active: spotlightActive })
    .eq('id', userId)

  if (error) {
    console.error('[toggleUserSpotlight] Supabase error:', error)
    return { error: `Spotlight güncelleme hatası: ${error.message}` }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard/influencer')
  revalidatePath('/vitrin')

  return { success: true, message: spotlightActive ? 'Spotlight aktif edildi.' : 'Spotlight deaktif edildi.' }
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