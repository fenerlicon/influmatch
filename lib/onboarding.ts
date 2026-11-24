// Profil tamamlama (onboarding): web server action'ı (app/onboarding/actions.ts) ve mobil
// /api/mobile/onboarding aynı kodu kullanır (ortak sunucu kodu deseni: (supabase, user, ...)).
// İstemci formu da doğrular ama kurallar burada tekrar uygulanır; istemciye güvenilmez.

import type { SupabaseClient } from '@supabase/supabase-js'
import { awardBadgesForUser } from '@/utils/badgeAwarding'
import { sendWelcomeMessage } from '@/lib/welcome-message'
import { validateTaxNumber } from '@/lib/tax-id'
import { validateCorporateEmail } from '@/lib/corporate-email'
import { saveCorporateEmail, sendCorporateEmailCode } from '@/lib/corporate-email-verification'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { isAllowedAvatarUrl } from '@/lib/avatar-url'
import { validateInstagram, validateTikTok, validateYouTube, validateWebsite } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import { completeOAuthSignup, needsSignupConsent } from '@/lib/oauth-signup'
import { normalizePhone } from '@/lib/phone-shared'
import { saveOwnContact } from '@/lib/user-contact'

export interface OnboardingPayload {
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
  /** Google ile gelen yeni hesapta Kullanım Koşulları onayı ve davet kodu burada alınır (lib/oauth-signup.ts). */
  legalConsent?: boolean
  inviteCode?: string | null
  signupSource?: 'web' | 'mobile'
  /** Zorunlu telefon (2026-11-24; yalnızca platform görür, lib/user-contact.ts) ve isteğe bağlı pazarlama izni. */
  phone?: string | null
  marketingSms?: boolean
  socialLinks: {
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    website?: string | null
  }
}

export type OnboardingResult =
  | { success: true; data: { id: string; role: string | null; full_name: string | null; username: string | null } }
  | { success: false; error: string }

const fail = (error: string): OnboardingResult => ({ success: false, error })

/** Sosyal linkleri web kurallarıyla doğrular ve normalize eder. Hata varsa Türkçe mesaj döner. */
function normalizeSocialLinks(
  role: 'influencer' | 'brand',
  links: OnboardingPayload['socialLinks'],
): { links: Record<string, string | null> } | { error: string } {
  const instagram = links.instagram?.trim() || ''
  const tiktok = links.tiktok?.trim() || ''
  const youtube = links.youtube?.trim() || ''
  const instagramResult = validateInstagram(instagram)
  const tiktokResult = validateTikTok(tiktok)
  const youtubeResult = validateYouTube(youtube)

  if (instagram && !instagramResult.isValid) return { error: 'Geçersiz format: Instagram' }
  if (tiktok && !tiktokResult.isValid) return { error: 'Geçersiz format: TikTok' }
  if (youtube && !youtubeResult.isValid) return { error: 'Geçersiz format: YouTube' }

  const result: Record<string, string | null> = {
    instagram: instagram ? instagramResult.normalizedUrl || instagram : null,
    tiktok: tiktok ? tiktokResult.normalizedUrl || tiktok : null,
    youtube: youtube ? youtubeResult.normalizedUrl || youtube : null,
  }

  if (role === 'influencer') {
    if (!instagram && !tiktok && !youtube) return { error: 'En az bir sosyal medya hesabı gerekli.' }
    return { links: result }
  }

  // Markalar için web sitesi zorunlu (kurumsal e-posta bu alan adına bağlı).
  const website = links.website?.trim() || ''
  const websiteResult = validateWebsite(website)
  if (!website || !websiteResult.isValid) return { error: 'Şirketinizin web sitesi gerekli.' }
  result.website = websiteResult.normalizedUrl || website
  result.linkedin = null
  return { links: result }
}

/**
 * Profil tamamlama kaydı. `supabase` kullanıcının yetkileriyle çalışan istemcidir (web çerez, mobil Bearer);
 * gizli alanlar (kurumsal e-posta) admin istemcisiyle yazılır. Vergi bilgileri yalnızca `users` tablosuna
 * yazılır; hiçbir dış servise gönderilmez.
 */
export async function saveOnboarding(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  payload: OnboardingPayload,
): Promise<OnboardingResult> {
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id, role, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  // Rol mevcut kayıttan alınır; istemcinin gönderdiği rol yalnızca ilk kayıtta kullanılır.
  const role: 'influencer' | 'brand' =
    existingProfile?.role === 'brand' || existingProfile?.role === 'influencer'
      ? existingProfile.role
      : payload.role === 'brand'
        ? 'brand'
        : 'influencer'

  // Google ile gelen yeni hesap: Kullanım Koşulları onayı olmadan profil kaydedilmez (onboarding'de istenir).
  const consentAdmin = createSupabaseAdminClient()
  let completeSignup = false
  if (consentAdmin) {
    const { data: authUser } = await consentAdmin.auth.admin.getUserById(user.id)
    if (authUser?.user && (await needsSignupConsent(consentAdmin, authUser.user))) {
      if (payload.legalConsent !== true) return fail('Devam etmek için Kullanım Koşulları ve Gizlilik Politikası\'nı onaylayın.')
      completeSignup = true
    }
  }

  const normalizedFullName = payload.fullName?.trim() || null
  if (!normalizedFullName) return fail(role === 'brand' ? 'Marka adı gerekli.' : 'Ad soyad gerekli.')

  const usernameInput = payload.username?.trim().toLowerCase() || ''
  if (!usernameInput) return fail('Kullanıcı adı gerekli.')
  const usernameValidation = validateUsername(usernameInput)
  if (!usernameValidation.isValid) return fail(usernameValidation.error || 'Geçersiz kullanıcı adı.')
  const normalizedUsername = usernameValidation.normalized || usernameInput

  if (!payload.avatarUrl) {
    return fail(role === 'brand' ? 'Lütfen marka logosu yükleyin.' : 'Lütfen profil fotoğrafı yükleyin.')
  }
  if (!isAllowedAvatarUrl(payload.avatarUrl, user.id, existingProfile?.avatar_url)) {
    return fail('Geçersiz profil fotoğrafı adresi. Lütfen fotoğrafı yeniden yükleyin.')
  }

  // Telefon zorunlu (acil durumda yalnızca platform ulaşır). Profil kaydından önce doğrulanır, sonra yazılır (FK).
  const phoneCheck = normalizePhone(payload.phone)
  if ('error' in phoneCheck) return fail(phoneCheck.error)

  const social = normalizeSocialLinks(role, payload.socialLinks ?? {})
  if ('error' in social) return fail(social.error)

  // Vergi bilgileri yalnızca markada ve girildiyse doğrulanır (VKN/TCKN checksum, yerelde).
  let normalizedTaxId: string | null = null
  if (role === 'brand' && payload.taxId && payload.taxId.trim()) {
    const taxValidation = validateTaxNumber(payload.taxId)
    if (!taxValidation.isValid) return fail(taxValidation.error)
    normalizedTaxId = taxValidation.normalized
    if (!payload.taxOffice || !payload.taxOffice.trim()) {
      return fail('Vergi numarası girildiğinde vergi dairesi girmek zorunludur.')
    }
    if (!payload.taxOfficeCity || !payload.taxOfficeCity.trim()) {
      return fail('Vergi numarası girildiğinde şirketin bağlı olduğu il seçilmelidir.')
    }
  }

  // Markalar: web sitesinin alan adına ait kurumsal e-posta zorunlu (sarı tik için kodla doğrulanır).
  if (role === 'brand') {
    const corporateEmailCheck = validateCorporateEmail(payload.corporateEmail ?? '', social.links.website)
    if (!corporateEmailCheck.isValid) return fail(corporateEmailCheck.error)
  }

  const creatorType =
    role === 'influencer' && (payload.creatorType === 'influencer' || payload.creatorType === 'ugc' || payload.creatorType === 'both')
      ? payload.creatorType
      : null

  const profileFields = {
    full_name: normalizedFullName,
    username: normalizedUsername,
    city: payload.city?.trim() || null,
    bio: payload.bio?.trim() || null,
    avatar_url: payload.avatarUrl,
    tax_id: normalizedTaxId,
    tax_office: normalizedTaxId ? payload.taxOffice?.trim() || null : null,
    tax_office_city: normalizedTaxId ? payload.taxOfficeCity?.trim() || null : null,
    social_links: social.links,
    creator_type: creatorType,
    // Kategori yalnızca seçildiyse yazılır; boş gelirse mevcut değer silinmez.
    ...(payload.category ? { category: payload.category } : {}),
  }

  // Upsert yerine ayrı update/insert: gizli kolonlar (tax_id vb.) istemci rolüne okunamaz olduğu için
  // PostgREST upsert'inin ürettiği "ON CONFLICT DO UPDATE SET x = EXCLUDED.x" yetki hatası verir.
  const { data, error } = existingProfile
    ? await supabase.from('users').update(profileFields).eq('id', user.id).select('id, role, full_name, username').single()
    : await supabase
        .from('users')
        .insert({ id: user.id, email: user.email || '', role, ...profileFields })
        .select('id, role, full_name, username')
        .single()

  if (error) {
    console.error('[saveOnboarding] Save error:', error)
    if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
      return fail('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }
    return fail('Profil kaydedilemedi. Lütfen tekrar deneyin.')
  }

  // Kurumsal e-posta gizli bir kolondur; sunucu yazar ve doğrulama kodunu gönderir.
  // Kod gönderilemese bile kayıt tamamlanır; marka profilinden yeni kod isteyebilir.
  if (data?.role === 'brand' && payload.corporateEmail) {
    const admin = createSupabaseAdminClient()
    if (admin) {
      try {
        const saved = await saveCorporateEmail(admin, user.id, payload.corporateEmail)
        if (saved.success) await sendCorporateEmailCode(admin, user.id)
        else console.error('[saveOnboarding] Corporate email:', saved.error)
      } catch (corporateError) {
        console.error('[saveOnboarding] Corporate email error:', corporateError)
      }
    }
  }

  const savedPhone = await saveOwnContact(user.id, { phone: phoneCheck.phone, marketingSms: payload.marketingSms === true }, payload.signupSource ?? 'web')
  if (!savedPhone.success) return fail(savedPhone.error)

  if (completeSignup && consentAdmin) {
    await completeOAuthSignup(consentAdmin, user.id, { inviteCode: payload.inviteCode ?? null, source: payload.signupSource ?? 'web' })
  }

  try {
    await awardBadgesForUser(user.id)
  } catch (badgeError) {
    console.error('[saveOnboarding] Failed to award badges:', badgeError)
  }

  // Hoş geldin mesajı (idempotent: mevcut sohbet varsa yenisini açmaz)
  try {
    await sendWelcomeMessage(user.id, data?.role === 'brand' ? 'brand' : 'influencer')
  } catch (msgError) {
    console.error('[saveOnboarding] Failed to send welcome message:', msgError)
  }

  return { success: true, data }
}
