'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { createClient } from '@supabase/supabase-js'
import { fetchInstagramData } from '@/utils/instagram-service'
import { validateTaxNumber } from '@/lib/tax-id'
import { syncBlueTick, sweepBlueTicks, type BlueTickOverride } from '@/lib/blue-tick'
import { grantOfficialBusiness, loadLatestTaxVerifications, TAX_DOCUMENTS_BUCKET } from '@/lib/tax-verification'
import { evaluateOfficialBusiness, syncOfficialBusiness } from '@/lib/official-business'


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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Use Admin Client to bypass RLS for updates in OTHER users' profiles
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı (Service Role Key eksik olabilir).' }
  }

  const { error } = await supabaseAdmin
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Use Admin Client to bypass RLS
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası.' }
  }

  const { error } = await supabaseAdmin
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Use Admin Client
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası.' }
  }

  const { error } = await supabaseAdmin
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  if (!badgeId || badgeId.trim() === '') {
    return { error: 'Rozet ID\'si gereklidir.' }
  }

  // Mavi tik kurala bağlı; elle verilmesi kalıcı istisna olarak kaydedilir (yoksa saatlik görev geri alır).
  if (badgeId.trim() === 'verified-account') {
    return setBlueTickOverride(userId, 'granted')
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
  console.log('[toggleUserSpotlight] Request:', { userId, spotlightActive, plan, durationMonths })

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('[toggleUserSpotlight] Auth error:', authError)
    return { error: 'Oturum açmanız gerekiyor. (Auth hatası)' }
  }

  console.log('[toggleUserSpotlight] Auth User:', user.email, user.id)

  // Check if user is admin
  const { data: adminProfile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[toggleUserSpotlight] Profile fetch error:', profileError)
  }

  console.log('[toggleUserSpotlight] Admin Profile:', adminProfile)

  const isAdmin = adminProfile?.role === 'admin'

  console.log('[toggleUserSpotlight] isAdmin check:', { 
    role: adminProfile?.role, 
    isAdmin 
  })

  if (!isAdmin) {
    console.warn('[toggleUserSpotlight] Unauthorized attempt by:', user.email, 'Target:', userId)
    return { error: `Bu işlem için yetkiniz yok. (Sizin rolünüz: ${adminProfile?.role || 'null'}, E-posta: ${user.email})` }
  }

  if (spotlightActive && !plan) {
    return { error: 'Spotlight aktifleştirmek için bir paket seçmelisiniz.' }
  }

  const updateData: any = { spotlight_active: spotlightActive }

  if (spotlightActive) {
    updateData.spotlight_plan = plan
    updateData.verification_status = 'verified' // Auto-verify on spotlight activation

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

  // Use Admin Client to bypass RLS
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    console.error('[toggleUserSpotlight] Service Role Client initialization failed.')
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı (Service Role Key eksik olabilir).' }
  }

  console.log('[toggleUserSpotlight] Checking target user existence:', userId)
  const { data: targetUser, error: fetchError } = await supabaseAdmin.from('users').select('id, email, full_name').eq('id', userId).maybeSingle()

  if (fetchError) {
    console.error('[toggleUserSpotlight] Target user fetch error:', fetchError)
    return { error: `Hedef kullanıcı bilgisi alınamadı: ${fetchError.message}` }
  }

  if (!targetUser) {
    console.error('[toggleUserSpotlight] Target user not found:', userId)
    return { error: `Kullanıcı bulunamadı (ID: ${userId}). Veritabanında bu ID ile bir kayıt olmayabilir.` }
  }

  console.log('[toggleUserSpotlight] Updating user:', targetUser.email || targetUser.full_name || userId, 'with data:', updateData)

  const { error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', userId)

  if (error) {
    console.error('[toggleUserSpotlight] Supabase update error:', error)
    return { error: `Spotlight güncelleme hatası: ${error.message} (Kod: ${error.code})` }
  }

  console.log('[toggleUserSpotlight] Successfully updated user:', userId)

  // Mavi tik Spotlight üyeliğine bağlı: açılınca kazanılabilir, kapanınca düşer.
  await syncBlueTick(userId, supabaseAdmin)

  revalidatePath('/admin')
  revalidatePath('/dashboard/influencer')
  revalidatePath('/dashboard/brand')
  revalidatePath('/spotlight') // Corrected from /vitrin
  revalidatePath('/discover')

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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Check if user has tax_id
  const { createSupabaseAdminClient: createTaxAdminClient } = await import('@/utils/supabase/admin')
  const taxAdminClient = createTaxAdminClient()
  if (!taxAdminClient) {
    return { error: 'Sistem yapılandırma hatası.' }
  }
  const { data: userProfile } = await taxAdminClient
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

  if (!validateTaxNumber(userProfile.tax_id).isValid) {
    return { error: 'Bu vergi numarası algoritma kontrolünden geçmiyor (geçersiz numara). Markadan düzeltmesini isteyin.' }
  }

  if (userProfile.role !== 'brand') {
    return { error: 'Bu işlem sadece markalar için geçerlidir.' }
  }

  // Use Admin Client to bypass RLS
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı.' }
  }

  let badgeChange: 'granted' | 'revoked' | null = null
  try {
    badgeChange = await grantOfficialBusiness(supabaseAdmin, userId)
  } catch (grantError) {
    console.error('[verifyTaxId] Error:', grantError)
    return { error: grantError instanceof Error ? grantError.message : 'Vergi numarası onaylanamadı.' }
  }

  // İncelemede bekleyen vergi levhası doğrulaması varsa admin onayı olarak kapatılır.
  await supabaseAdmin
    .from('tax_verifications')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['needs_review', 'processing'])

  revalidatePath('/admin')
  revalidatePath('/dashboard/brand/badges')
  revalidatePath('/dashboard/brand')

  return {
    success: true,
    message:
      badgeChange === 'granted'
        ? 'Vergi numarası onaylandı ve "Resmi İşletme" rozeti verildi.'
        : 'Vergi numarası onaylandı. Sarı tik için markanın şirket alan adındaki kurumsal e-postasını doğrulaması bekleniyor.',
  }
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı (Service Role Key eksik olabilir).' }
  }

  // E-posta istemci rollerine kapalı; service role ile okunur.
  const { data: targetUser, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  if (fetchError || !targetUser?.email) {
    return { error: 'Kullanıcı veya email adresi bulunamadı.' }
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

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
    await supabaseAdmin.from('users').update({ email_verified_at: new Date().toISOString() }).eq('id', userId)

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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

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

    // Silinen tikler vitrinden de kalkar; ardından yeni kurala (Spotlight + performans + güven)
    // uyan kullanıcılar ve admin istisnaları tekrar tik alır.
    const summary = await sweepBlueTicks(adminClient)

    revalidatePath('/admin')
    revalidatePath(`/dashboard/influencer/badges`)
    revalidatePath(`/dashboard/brand/badges`)
    return {
      success: true,
      message: `${count ?? 'Bilinmeyen sayıda'} mavi tik silindi; yeni kurala göre ${summary.granted} kullanıcıya tekrar verildi.`,
    }
  } catch (error: any) {
    console.error('[resetVerifiedBadges] Error:', error)
    return { error: error.message || 'Sıfırlama işlemi sırasında hata oluştu.' }
  }
}

type AdminActionResult =
  | { success: true; message: string; error?: undefined }
  | { error: string; success?: undefined; message?: undefined }

// Mavi tik istisnası (admin): 'granted' kurala bakmadan verir, 'revoked' hiç vermez, null otomatik kurala döner.
export async function setBlueTickOverride(userId: string, override: BlueTickOverride): Promise<AdminActionResult> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' }

  if (override !== null && override !== 'granted' && override !== 'revoked') {
    return { error: 'Geçersiz işlem.' }
  }

  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı.' }

  const { error } = await supabaseAdmin.from('users').update({ blue_tick_override: override }).eq('id', userId)
  if (error) {
    console.error('[setBlueTickOverride] Error:', error)
    return { error: `Mavi tik güncellenemedi: ${error.message}` }
  }

  await syncBlueTick(userId, supabaseAdmin)

  revalidatePath('/admin')
  revalidatePath('/dashboard/influencer/badges')
  revalidatePath('/dashboard/messages')

  const messages = {
    granted: 'Mavi tik elle verildi (otomatik kuraldan bağımsız, siz kaldırana kadar kalır).',
    revoked: 'Mavi tik elle kaldırıldı (kural sağlansa bile verilmez).',
    auto: 'Mavi tik otomatik kurala döndürüldü.',
  }
  return { success: true, message: messages[override ?? 'auto'] }
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

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

    // Mavi tik kurala bağlı (Spotlight + performans + güven). Admin düğmesi rozeti doğrudan
    // değiştirmek yerine kalıcı istisna tanımlar; aksi halde saatlik görev kararı geri alırdı.
    if (targetUser.role !== 'brand') {
      const { data: blueTick } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', 'verified-account')
        .maybeSingle()
      const result = await setBlueTickOverride(userId, blueTick ? 'revoked' : 'granted')
      if (result.error) return { error: result.error }
      return { success: true, message: result.message, action: blueTick ? 'removed' : 'added' }
    }

    // Sarı tik kurala bağlı (vergi onayı + doğrulanmış kurumsal e-posta). Admin düğmesi vergi onayını
    // verir / geri alır; rozet lib/official-business.ts kuralıyla eşitlenir.
    const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
    const supabaseAdmin = createSupabaseAdminClient()
    if (!supabaseAdmin) {
      return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı.' }
    }

    const { data: brand } = await supabaseAdmin
      .from('users')
      .select('tax_id_verified, corporate_email, corporate_email_verified_at, social_links')
      .eq('id', userId)
      .single()
    const state = evaluateOfficialBusiness(brand ?? { tax_id_verified: false, corporate_email: null, corporate_email_verified_at: null, social_links: null })
    const { data: existingBadge } = await supabaseAdmin
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', 'official-business')
      .maybeSingle()

    let action = ''
    let message = ''

    if (existingBadge) {
      const { error: revokeError } = await supabaseAdmin.from('users').update({ tax_id_verified: false }).eq('id', userId)
      if (revokeError) throw revokeError
      await syncOfficialBusiness(supabaseAdmin, userId)
      action = 'removed'
      message = 'Sarı tik kaldırıldı (vergi onayı geri alındı).'
    } else {
      if (!state.corporateEmailVerified || !state.domainMatches) {
        return { error: 'Sarı tik için markanın şirket alan adına ait kurumsal e-postasını doğrulaması gerekiyor.' }
      }
      await grantOfficialBusiness(supabaseAdmin, userId)
      action = 'added'
      message = 'Vergi numarası onaylandı ve sarı tik verildi.'
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    console.warn('[deleteUser] Unauthorized attempt by:', user.email)
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Silme service role ile yapılır (lib/account-deletion.ts).
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    console.error('[deleteUser] Service Role Key missing or invalid')
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı.' }
  }

  if (userId === user.id) {
    return { error: 'Kendi hesabınızı admin panelinden silemezsiniz.' }
  }

  try {
    const { data: target } = await supabaseAdmin.from('users').select('role').eq('id', userId).maybeSingle()
    if (target?.role === 'admin') {
      return { error: 'Admin hesapları panelden silinemez.' }
    }

    const { deleteAccountCompletely } = await import('@/lib/account-deletion')
    const result = await deleteAccountCompletely(supabaseAdmin, userId)
    if (!result.ok) {
      return { error: result.error }
    }
    if (!result.authDeleted) {
      console.warn('[deleteUser] Giriş kaydı silinemedi; kullanıcı kilitli bırakıldı:', userId)
    }

    revalidatePath('/admin')
    revalidatePath('/dashboard/influencer')
    revalidatePath('/dashboard/brand')

    return { success: true, message: 'Kullanıcı ve tüm verileri silindi.' }
  } catch (error: any) {
    console.error('[deleteUser] Exception:', error)
    return { error: error.message || 'Silme işlemi sırasında bir hata oluştu.' }
  }
}

// Get all adverts for admin management
export async function getAllAdverts() {
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası.' }
  }

  const { data: adverts, error } = await supabaseAdmin
    .from('advert_projects')
    .select('*, brand:brand_user_id(full_name, email, avatar_url, username)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllAdverts] Supabase error:', error)
    return { error: `İlanlar alınamadı: ${error.message}` }
  }

  return { success: true, adverts: adverts || [] }
}

// Delete any advert (Admin only)
export async function deleteAdvertAdmin(advertId: string) {
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Bu işlem için yetkiniz yok.' }
  }

  // Use Admin Client to bypass RLS
  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()

  if (!supabaseAdmin) {
    return { error: 'Sistem yapılandırma hatası: Admin yetkisi alınamadı.' }
  }

  // Get hero image to delete from storage
  const { data: advert } = await supabase
    .from('advert_projects')
    .select('hero_image')
    .eq('id', advertId)
    .single()

  if (advert?.hero_image) {
    try {
      const imagePath = advert.hero_image.split('/').pop()
      if (imagePath) {
        await supabaseAdmin.storage.from('advert-hero-images').remove([imagePath])
      }
    } catch (e) {
      console.warn('[deleteAdvertAdmin] Hero image deletion failed:', e)
    }
  }

  const { error } = await supabaseAdmin
    .from('advert_projects')
    .delete()
    .eq('id', advertId)

  if (error) {
    console.error('[deleteAdvertAdmin] Supabase error:', error)
    return { error: `İlan silme hatası: ${error.message}` }
  }

  revalidatePath('/admin')
  return { success: true, message: 'İlan başarıyla silindi.' }
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
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle()

    const isAdmin = adminProfile?.role === 'admin'

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
    // 2. FETCH DATA using Apify Service
    let normalizedData;

    try {
      normalizedData = await fetchInstagramData(username);
    } catch (apiError: any) {
      console.error('[adminUpdateInstagramData] Instagram Service Error:', apiError)
      return { success: false, error: `Veri çekme hatası: ${apiError.message || 'Apify servis hatası'}` }
    }

    // normalizedData is guaranteed to be set here (all failure paths return early above)
    if (!normalizedData) {
      return { success: false, error: 'Beklenmeyen hata: veri alınamadı.' }
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

    // Filter out Pinned Posts explicitly
    let filteredEdges = edges;
    if (filteredEdges) {
        filteredEdges = filteredEdges.filter((edge: any) => {
            const node = edge.node;
            if (node.is_pinned === true) return false;
            if (node.pinned_for_users && node.pinned_for_users.length > 0) return false;
            return true;
        });
    }

    // 3. Stats Calculation Logic
    // We analyze up to 12 recent non-pinned posts (instead of just 6) for more accurate frequency tracking
    const recentPosts = filteredEdges.slice(0, 12).map((edge: any) => edge.node)


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
        const rawRate = ((avgLikes + avgComments) / followerCount) * 100
        engagementRate = Math.min(parseFloat(rawRate.toFixed(2)), 999.99)
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
    const now = new Date().toISOString()

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
      posting_frequency: averageIntervalDays,
      analyzed_post_urls: recentPosts.map((p: any) => `https://www.instagram.com/p/${p.shortcode}/`),
      // Calculate changes vs previous data
      changes: {
        engagement_rate: account.engagement_rate ? parseFloat((engagementRate - account.engagement_rate).toFixed(2)) : 0,
        follower_count: account.follower_count ? followerCount - account.follower_count : 0,
        avg_likes: account.stats_payload?.avg_likes ? avgLikes - account.stats_payload.avg_likes : 0,
        avg_views: account.stats_payload?.avg_views ? avgViews - account.stats_payload.avg_views : 0,
        updated_at: now
      }
    }



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

    // 5. Insert into History (New Feature)
    const { error: historyError } = await supabaseAdmin
      .from('social_account_history')
      .insert({
        social_account_id: account.id,
        follower_count: followerCount,
        engagement_rate: engagementRate,
        avg_likes: avgLikes,
        avg_comments: avgComments,
        avg_views: avgViews,
        recorded_at: now
      })

    if (historyError) {
      console.error('Error logging history:', historyError)
      // Don't fail the main request, just log it
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
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

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
    const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
    const lookupClient = createSupabaseAdminClient()
    if (!lookupClient) {
      return { success: false, error: 'Sistem yapılandırma hatası.' }
    }
    const { data: publicUser } = await lookupClient
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
  let recentPosts: any[] = []
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
    let edges = data.recent_posts || []

    // Calculate Stats
    let avgLikes = 0
    let avgComments = 0
    let avgViews = 0

    if (edges.length > 0) {
      // Filter out Pinned Posts explicitly (Handle both API structures)
      edges = edges.filter((edge: any) => {
        const node = edge.node;
        // Custom flag from RocketAPI wrapper OR standard Instagram structure
        if (node.is_pinned === true) return false;
        if (node.pinned_for_users && node.pinned_for_users.length > 0) return false;
        return true;
      });

      // Sort edges by date (newest first) to correctly handle Pinned Posts
      edges.sort((a: any, b: any) => {
        const timeA = Number(a.node?.taken_at_timestamp) || 0
        const timeB = Number(b.node?.taken_at_timestamp) || 0
        return timeB - timeA
      })

      recentPosts = edges.slice(0, 6).map((edge: any) => edge.node)
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
        posting_frequency: 0,
        analyzed_post_urls: recentPosts.map((p: any) => `https://www.instagram.com/p/${p.shortcode}/`)
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

  // 3. Hesap bağlamak mavi tik vermez; mavi tik kuralı güncel verilerle yeniden değerlendirilir.
  await syncBlueTick(targetUserId, supabaseAdmin)

  revalidatePath('/admin')
  return {
    success: true,
    message: `Kullanıcı (${instagramUsername}) başarıyla bağlandı ve onaylandı.`,
    analyzed_posts: recentPosts.map((p: any) => `https://www.instagram.com/p/${p.shortcode}/`)
  }
}

export async function getAllApplications() {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }

  const { data: adminProfile } = await createSupabaseServerClient()
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'
  if (!isAdmin) return { error: 'Yetkisiz erişim.' }

  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) return { error: 'Admin yetkisi alınamadı.' }

  const { data, error } = await supabaseAdmin
    .from('advert_applications')
    .select(`
      *,
      influencer:influencer_user_id (id, full_name, email, username),
      advert:advert_id (id, title, brand_user_id)
    `)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { success: true, applications: data }
}

/**
 * Admin paneli için tek bir kullanıcının kart verisini (hassas kolonlar dahil) döner.
 * Hassas kolonlar istemci rollerine kapalı olduğu için service role ile okunur.
 */
export async function getAdminUserCard(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') return { error: 'Yetkisiz erişim.' }

  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) return { error: 'Sistem yapılandırma hatası.' }

  const { ADMIN_USER_SELECT } = await import('@/lib/user-columns')
  const { data, error } = await supabaseAdmin.from('users').select(ADMIN_USER_SELECT).eq('id', userId).maybeSingle()
  if (error || !data) return { error: 'Kullanıcı bulunamadı.' }

  const taxVerifications = data.role === 'brand' ? await loadLatestTaxVerifications(supabaseAdmin, [userId]) : {}
  return { user: { ...data, tax_verification: taxVerifications[userId] ?? null } }
}

async function requireAdminClient() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' as const }

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' as const }

  const { createSupabaseAdminClient } = await import('@/utils/supabase/admin')
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) return { error: 'Sistem yapılandırma hatası.' as const }
  return { user, supabaseAdmin }
}

// Vergi levhası belgesini admin için 10 dakikalık imzalı bağlantıyla açar.
export async function getTaxDocumentUrl(verificationId: string) {
  const auth = await requireAdminClient()
  if ('error' in auth) return { error: auth.error }

  const { data: verification } = await auth.supabaseAdmin
    .from('tax_verifications')
    .select('file_path')
    .eq('id', verificationId)
    .maybeSingle()
  if (!verification) return { error: 'Belge bulunamadı.' }

  const { data, error } = await auth.supabaseAdmin.storage
    .from(TAX_DOCUMENTS_BUCKET)
    .createSignedUrl(verification.file_path, 600)
  if (error || !data) return { error: 'Belge bağlantısı oluşturulamadı.' }
  return { url: data.signedUrl }
}

// İncelemedeki vergi levhasını reddeder; marka yeni belge yükleyebilir.
export async function rejectTaxVerification(verificationId: string, note: string) {
  const auth = await requireAdminClient()
  if ('error' in auth) return { error: auth.error }

  const reason = note.trim() || 'Belge admin tarafından kabul edilmedi.'
  const { error } = await auth.supabaseAdmin
    .from('tax_verifications')
    .update({
      status: 'rejected',
      reasons: [reason],
      review_note: reason,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', verificationId)
    .in('status', ['needs_review', 'processing'])
  if (error) return { error: `Reddedilemedi: ${error.message}` }

  revalidatePath('/admin')
  return { success: true, message: 'Vergi levhası reddedildi; marka yeni belge yükleyebilir.' }
}
