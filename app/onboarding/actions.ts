'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

interface SaveOnboardingPayload {
  userId: string
  role: 'influencer' | 'brand'
  fullName: string
  username: string
  city: string
  bio: string
  category: string
  avatarUrl: string | null
  taxId?: string | null
  taxOffice?: string | null
  taxOfficeCity?: string | null
  corporateEmail?: string | null
  creatorType?: 'influencer' | 'ugc' | 'both'
  socialLinks: {
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    website?: string | null
    linkedin?: string | null
    kick?: string | null
    twitter?: string | null
    twitch?: string | null
  }
}

import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { sendWelcomeMessage } from '@/lib/welcome-message'
import { validateTaxNumber } from '@/lib/tax-id'
import { validateCorporateEmail } from '@/lib/corporate-email'
import { saveCorporateEmail, sendCorporateEmailCode } from '@/lib/corporate-email-verification'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { isAllowedAvatarUrl } from '@/lib/avatar-url'

export async function saveOnboardingProfile(payload: SaveOnboardingPayload) {
  const supabase = createSupabaseServerClient()

  // Verify user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== payload.userId) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  // Validate tax details if taxId is provided
  let normalizedTaxId: string | null = null
  if (payload.taxId && payload.taxId.trim()) {
    const taxValidation = validateTaxNumber(payload.taxId)
    if (!taxValidation.isValid) {
      return { success: false, error: taxValidation.error }
    }
    normalizedTaxId = taxValidation.normalized
    if (!payload.taxOffice || !payload.taxOffice.trim()) {
      return { success: false, error: 'Vergi numarası girildiğinde vergi dairesi girmek zorunludur.' }
    }
    if (!payload.taxOfficeCity || !payload.taxOfficeCity.trim()) {
      return { success: false, error: 'Vergi numarası girildiğinde şirketin bağlı olduğu il seçilmelidir.' }
    }
  }

  // Markalar: web sitesinin alan adına ait kurumsal e-posta zorunlu (sarı tik için kodla doğrulanır).
  if (payload.role === 'brand') {
    const corporateEmailCheck = validateCorporateEmail(payload.corporateEmail ?? '', payload.socialLinks.website)
    if (!corporateEmailCheck.isValid) {
      return { success: false, error: corporateEmailCheck.error }
    }
  }

  // Normalize data
  const normalizedUsername = payload.username?.trim() || null
  const normalizedCity = payload.city?.trim() || null
  const normalizedBio = payload.bio?.trim() || null
  const normalizedFullName = payload.fullName?.trim() || null

  const profileFields = {
    full_name: normalizedFullName,
    username: normalizedUsername,
    city: normalizedCity,
    bio: normalizedBio,
    avatar_url: payload.avatarUrl,
    tax_id: normalizedTaxId,
    tax_office: payload.taxOffice?.trim() || null,
    tax_office_city: payload.taxOfficeCity?.trim() || null,
    social_links: payload.socialLinks,
    creator_type: payload.creatorType || null,
    // Kategori yalnızca seçildiyse yazılır; boş gelirse mevcut değer silinmez.
    ...(payload.category ? { category: payload.category } : {}),
  }

  // Upsert yerine ayrı update/insert: gizli kolonlar (tax_id vb.) istemci rolüne okunamaz olduğu için
  // PostgREST upsert'inin ürettiği "ON CONFLICT DO UPDATE SET x = EXCLUDED.x" yetki hatası verir.
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id, avatar_url')
    .eq('id', payload.userId)
    .maybeSingle()

  if (!isAllowedAvatarUrl(payload.avatarUrl, payload.userId, existingProfile?.avatar_url)) {
    return { success: false, error: 'Geçersiz profil fotoğrafı adresi. Lütfen fotoğrafı yeniden yükleyin.' }
  }

  const { data, error } = existingProfile
    ? await supabase
        .from('users')
        .update(profileFields)
        .eq('id', payload.userId)
        .select('id, role, full_name, username')
        .single()
    : await supabase
        .from('users')
        .insert({ id: payload.userId, email: user.email || '', role: payload.role, ...profileFields })
        .select('id, role, full_name, username')
        .single()

  if (error) {
    console.error('[saveOnboardingProfile] Save error:', error)

    // Check if it's a unique constraint violation
    if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
      return { success: false, error: 'Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.' }
    }
    return { success: false, error: 'Profil kaydedilemedi. Lütfen tekrar deneyin.' }
  }

  // Kurumsal e-posta gizli bir kolondur; sunucu yazar ve doğrulama kodunu gönderir.
  // Kod gönderilemese bile kayıt tamamlanır; marka profilinden yeni kod isteyebilir.
  if (data?.role === 'brand' && payload.corporateEmail) {
    const admin = createSupabaseAdminClient()
    if (admin) {
      try {
        const saved = await saveCorporateEmail(admin, payload.userId, payload.corporateEmail)
        if (saved.success) await sendCorporateEmailCode(admin, payload.userId)
        else console.error('[saveOnboardingProfile] Corporate email:', saved.error)
      } catch (corporateError) {
        console.error('[saveOnboardingProfile] Corporate email error:', corporateError)
      }
    }
  }

  // Award badges directly on server side (no extra HTTP request needed)
  try {
    await awardBadgesForUser(payload.userId)
  } catch (badgeError) {
    console.error('[saveOnboardingProfile] Failed to award badges:', badgeError)
    // Don't fail the whole request if badge awarding fails
  }

  // Send Welcome Message (idempotent: mevcut sohbet varsa yenisini açmaz)
  try {
    const role = data?.role === 'brand' ? 'brand' : 'influencer'
    await sendWelcomeMessage(payload.userId, role)
  } catch (msgError) {
    console.error('[saveOnboardingProfile] Failed to send welcome message:', msgError)
  }

  revalidatePath('/dashboard')
  revalidatePath('/onboarding')

  return { success: true, data }
}
