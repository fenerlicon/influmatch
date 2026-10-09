// Profil kaydetme (influencer ve marka): web server action'ları ve mobil /api/mobile/profile aynı kodu
// kullanır (ortak sunucu kodu deseni: (supabase, userId, ...)). Hatalar kullanıcıya gösterilecek
// Türkçe mesajla Error olarak fırlatılır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isAllowedAvatarUrl } from '@/lib/avatar-url'
import { validateInstagram, validateTikTok, validateYouTube, validateKick, validateTwitter, validateTwitch, validateLinkedIn, validateWebsite } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import { validateTaxNumber } from '@/lib/tax-id'
import { isUsernameTaken } from '@/lib/profile-reads'

export interface UpdateProfilePayload {
  fullName: string
  username: string
  previousUsername: string
  city: string
  bio: string
  category: string
  avatarUrl: string | null
  creatorType?: 'influencer' | 'ugc' | 'both'
  socialLinks: {
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    kick?: string | null
    twitter?: string | null
    twitch?: string | null
  }
  displayedBadges?: string[]
}

/** Influencer profilini doğrular ve kaydeder. Rozet verme ve sayfa yenileme çağıranın işidir. */
export async function saveInfluencerProfile(supabase: SupabaseClient, userId: string, payload: UpdateProfilePayload): Promise<{ username: string | null }> {
  // Get current user's data from database
  const { data: currentUser, error: currentUserError } = await supabase
    .from('users')
    .select('username, social_links, social_links_last_updated, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (currentUserError) {
    console.error('[updateProfile] Error fetching current user:', currentUserError)
    throw new Error('Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.')
  }

  if (!currentUser) {
    throw new Error('Kullanıcı bulunamadı.')
  }

  if (!isAllowedAvatarUrl(payload.avatarUrl, userId, currentUser.avatar_url)) {
    throw new Error('Geçersiz görsel adresi. Lütfen görseli yeniden yükleyin.')
  }

  const currentUsername = currentUser?.username
  const currentSocialLinks = (currentUser?.social_links as Record<string, string | null>) || {}
  const socialLinksLastUpdated = currentUser?.social_links_last_updated || null

  // If user already has a username, prevent changing it
  if (currentUsername && payload.username && payload.username.trim()) {
    const trimmedNewUsername = payload.username.trim().toLowerCase()
    const trimmedCurrentUsername = currentUsername.trim().toLowerCase()
    
    // If trying to change username, reject it
    if (trimmedNewUsername !== trimmedCurrentUsername) {
      throw new Error('Kullanıcı adı bir kez belirlendikten sonra değiştirilemez.')
    }
  }

  // Validate username format and uniqueness if username is provided and user doesn't have one yet
  if (payload.username && payload.username.trim() && !currentUsername) {
    const trimmedUsername = payload.username.trim().toLowerCase()
    
    // Validate format (Instagram rules)
    const usernameValidation = validateUsername(trimmedUsername)
    if (!usernameValidation.isValid) {
      throw new Error(usernameValidation.error || 'Kullanıcı adı geçersiz.')
    }

    const normalizedUsername = usernameValidation.normalized || trimmedUsername

    // Başka hesapların satırları oturumla okunamaz (3.17-S2); kontrol sunucuda service role ile yapılır.
    if (await isUsernameTaken(normalizedUsername, userId)) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }

    // Use normalized username
    payload.username = normalizedUsername
  } else if (currentUsername) {
    // Keep existing username if user already has one
    payload.username = currentUsername
  }

  // Check if social links have changed
  const newSocialLinks = {
    instagram: payload.socialLinks.instagram?.trim() || null,
    tiktok: payload.socialLinks.tiktok?.trim() || null,
    youtube: payload.socialLinks.youtube?.trim() || null,
    kick: payload.socialLinks.kick?.trim() || null,
    twitter: payload.socialLinks.twitter?.trim() || null,
    twitch: payload.socialLinks.twitch?.trim() || null,
  }

  // Normalize current social links for comparison
  const normalizedCurrentSocialLinks = {
    instagram: currentSocialLinks.instagram?.trim() || null,
    tiktok: currentSocialLinks.tiktok?.trim() || null,
    youtube: currentSocialLinks.youtube?.trim() || null,
    kick: currentSocialLinks.kick?.trim() || null,
    twitter: currentSocialLinks.twitter?.trim() || null,
    twitch: currentSocialLinks.twitch?.trim() || null,
  }

  // Check if any social link has changed
  const socialLinksChanged = JSON.stringify(newSocialLinks) !== JSON.stringify(normalizedCurrentSocialLinks)

  // If social links changed, check if 30 days have passed since last update
  if (socialLinksChanged && socialLinksLastUpdated) {
    const lastUpdated = new Date(socialLinksLastUpdated)
    const now = new Date()
    const daysSinceLastUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceLastUpdate < 30) {
      const daysRemaining = 30 - daysSinceLastUpdate
      throw new Error(`Sosyal medya hesaplarınızı 30 günde sadece 1 kez değiştirebilirsiniz. ${daysRemaining} gün sonra tekrar değiştirebilirsiniz.`)
    }
  }

  // Validate social links
  const instagramResult = validateInstagram(payload.socialLinks.instagram)
  const tiktokResult = validateTikTok(payload.socialLinks.tiktok)
  const youtubeResult = validateYouTube(payload.socialLinks.youtube)
  const kickResult = validateKick(payload.socialLinks.kick)
  const twitterResult = validateTwitter(payload.socialLinks.twitter)
  const twitchResult = validateTwitch(payload.socialLinks.twitch)

  if (!instagramResult.isValid) {
    throw new Error(instagramResult.error || 'Geçersiz Instagram linki.')
  }
  if (!tiktokResult.isValid) {
    throw new Error(tiktokResult.error || 'Geçersiz TikTok linki.')
  }
  if (!youtubeResult.isValid) {
    throw new Error(youtubeResult.error || 'Geçersiz YouTube linki.')
  }
  if (!kickResult.isValid) {
    throw new Error(kickResult.error || 'Geçersiz Kick linki.')
  }
  if (!twitterResult.isValid) {
    throw new Error(twitterResult.error || 'Geçersiz Twitter/X linki.')
  }
  if (!twitchResult.isValid) {
    throw new Error(twitchResult.error || 'Geçersiz Twitch linki.')
  }

  // Normalize values: empty strings become null to satisfy constraints
  // Ensure username is set (either from payload or keep existing)
  const finalUsername = payload.username?.trim() || currentUsername || null
  const normalizedUsername = finalUsername
  const normalizedCity = payload.city?.trim() || null
  const normalizedBio = payload.bio?.trim() || null
  const normalizedFullName = payload.fullName?.trim() || null

  // Doğrulanmış hesapların linki doğrulanmış kullanıcı adından gelir; formdan değiştirilemez
  // (aksi halde profil, doğrulanmış hesaptan farklı bir hesabı gösterebilirdi).
  const { data: verifiedAccounts } = await supabase
    .from('social_accounts')
    .select('platform, username')
    .eq('user_id', userId)
    .eq('is_verified', true)
  const verifiedInstagram = verifiedAccounts?.find((a) => a.platform === 'instagram')?.username
  const verifiedTikTok = verifiedAccounts?.find((a) => a.platform === 'tiktok')?.username

  const updates: any = {
    full_name: normalizedFullName,
    username: normalizedUsername,
    city: normalizedCity,
    bio: normalizedBio,
    category: payload.category || null,
    avatar_url: payload.avatarUrl,
    creator_type: payload.creatorType || null,
    social_links: {
      instagram: verifiedInstagram ? `https://instagram.com/${verifiedInstagram}` : instagramResult.normalizedUrl || null,
      tiktok: verifiedTikTok ? `https://tiktok.com/@${verifiedTikTok}` : tiktokResult.normalizedUrl || null,
      youtube: youtubeResult.normalizedUrl || null,
      kick: kickResult.normalizedUrl || null,
      twitter: twitterResult.normalizedUrl || null,
      twitch: twitchResult.normalizedUrl || null,
    },
  }

  // Update social_links_last_updated if social links changed
  if (socialLinksChanged) {
    updates.social_links_last_updated = new Date().toISOString()
  }

  // Update displayed_badges if provided.
  // Mavi tik seçilebilir bir rozet değildir: kullanıcıda varsa her zaman ilk sırada gösterilir.
  if (payload.displayedBadges !== undefined) {
    const { data: blueTick } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)
      .eq('badge_id', 'verified-account')
      .maybeSingle()
    const chosen = payload.displayedBadges.filter((badgeId) => badgeId !== 'verified-account')
    updates.displayed_badges = (blueTick ? ['verified-account', ...chosen] : chosen).slice(0, 3)
  }


  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id')

  if (updateError) {
    console.error('[updateProfile] Update error:', updateError)
    // Check if it's a unique constraint violation for username
    if (updateError.code === '23505' || updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }
    
    throw new Error('Profil kaydedilemedi. Lütfen tekrar deneyin.')
  }

  return { username: payload.username || null }
}

export interface UpdateBrandProfilePayload {
  brandName: string
  username: string
  city: string
  bio: string
  category: string
  logoUrl: string | null
  website: string
  linkedin: string
  instagram: string
  kick?: string | null
  twitter?: string | null
  twitch?: string | null
  displayedBadges?: string[]
  companyLegalName?: string | null
  taxId?: string | null
  taxOffice?: string | null
  taxOfficeCity?: string | null
}

/** Marka profilini doğrular ve kaydeder. Yasal bilgiler (companyLegalName, taxId...) undefined ise dokunulmaz. */
export async function saveBrandProfile(supabase: SupabaseClient, userId: string, payload: UpdateBrandProfilePayload): Promise<void> {
  if (!payload.brandName.trim()) {
    throw new Error('Marka adı gereklidir.')
  }

  // Get current user's data from database
  const { data: currentUser, error: currentUserError } = await supabase
    .from('users')
    .select('username, social_links, social_links_last_updated, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (currentUserError) {
    console.error('[updateBrandProfile] Error fetching current user:', currentUserError)
    throw new Error('Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.')
  }

  if (!currentUser) {
    throw new Error('Kullanıcı bulunamadı.')
  }

  if (!isAllowedAvatarUrl(payload.logoUrl, userId, currentUser.avatar_url)) {
    throw new Error('Geçersiz görsel adresi. Lütfen görseli yeniden yükleyin.')
  }

  const currentUsername = currentUser?.username
  const currentSocialLinks = (currentUser?.social_links as Record<string, string | null>) || {}
  const socialLinksLastUpdated = currentUser?.social_links_last_updated || null

  // If user already has a username, prevent changing it
  if (currentUsername && payload.username && payload.username.trim()) {
    const trimmedNewUsername = payload.username.trim().toLowerCase()
    const trimmedCurrentUsername = currentUsername.trim().toLowerCase()

    // If trying to change username, reject it
    if (trimmedNewUsername !== trimmedCurrentUsername) {
      throw new Error('Kullanıcı adı bir kez belirlendikten sonra değiştirilemez.')
    }
  }

  // Validate username format and uniqueness if username is provided and user doesn't have one yet
  if (payload.username && payload.username.trim() && !currentUsername) {
    const trimmedUsername = payload.username.trim().toLowerCase()

    // Validate format (Instagram rules)
    const usernameValidation = validateUsername(trimmedUsername)
    if (!usernameValidation.isValid) {
      throw new Error(usernameValidation.error || 'Kullanıcı adı geçersiz.')
    }

    const normalizedUsername = usernameValidation.normalized || trimmedUsername

    // Başka hesapların satırları oturumla okunamaz (3.17-S2); kontrol sunucuda service role ile yapılır.
    if (await isUsernameTaken(normalizedUsername, userId)) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }

    // Use normalized username
    payload.username = normalizedUsername
  } else if (currentUsername) {
    // Keep existing username if user already has one
    payload.username = currentUsername
  }

  // Check if social links have changed
  const newSocialLinks = {
    website: payload.website?.trim() || null,
    linkedin: payload.linkedin?.trim() || null,
    instagram: payload.instagram?.trim() || null,
    kick: payload.kick?.trim() || null,
    twitter: payload.twitter?.trim() || null,
    twitch: payload.twitch?.trim() || null,
  }

  // Normalize current social links for comparison
  const normalizedCurrentSocialLinks = {
    website: currentSocialLinks.website?.trim() || null,
    linkedin: currentSocialLinks.linkedin?.trim() || null,
    instagram: currentSocialLinks.instagram?.trim() || null,
    kick: currentSocialLinks.kick?.trim() || null,
    twitter: currentSocialLinks.twitter?.trim() || null,
    twitch: currentSocialLinks.twitch?.trim() || null,
  }

  // Check if any social link has changed
  const socialLinksChanged = JSON.stringify(newSocialLinks) !== JSON.stringify(normalizedCurrentSocialLinks)

  // If social links changed, check if 30 days have passed since last update
  if (socialLinksChanged && socialLinksLastUpdated) {
    const lastUpdated = new Date(socialLinksLastUpdated)
    const now = new Date()
    const daysSinceLastUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceLastUpdate < 30) {
      const daysRemaining = 30 - daysSinceLastUpdate
      throw new Error(`Sosyal medya hesaplarınızı 30 günde sadece 1 kez değiştirebilirsiniz. ${daysRemaining} gün sonra tekrar değiştirebilirsiniz.`)
    }
  }

  // Validate social links
  const websiteResult = validateWebsite(payload.website)
  const linkedinResult = validateLinkedIn(payload.linkedin)
  const instagramResult = validateInstagram(payload.instagram)
  const kickResult = validateKick(payload.kick)
  const twitterResult = validateTwitter(payload.twitter)
  const twitchResult = validateTwitch(payload.twitch)

  if (!websiteResult.isValid) {
    throw new Error(websiteResult.error || 'Geçersiz web sitesi linki.')
  }
  if (!linkedinResult.isValid) {
    throw new Error(linkedinResult.error || 'Geçersiz LinkedIn linki.')
  }
  if (!instagramResult.isValid) {
    throw new Error(instagramResult.error || 'Geçersiz Instagram linki.')
  }
  if (!kickResult.isValid) {
    throw new Error(kickResult.error || 'Geçersiz Kick linki.')
  }
  if (!twitterResult.isValid) {
    throw new Error(twitterResult.error || 'Geçersiz Twitter/X linki.')
  }
  if (!twitchResult.isValid) {
    throw new Error(twitchResult.error || 'Geçersiz Twitch linki.')
  }

  // Validate tax details if taxId is provided
  let normalizedTaxId: string | null = null
  if (payload.taxId && payload.taxId.trim()) {
    const taxValidation = validateTaxNumber(payload.taxId)
    if (!taxValidation.isValid) {
      throw new Error(taxValidation.error)
    }
    normalizedTaxId = taxValidation.normalized
    if (!payload.taxOffice || !payload.taxOffice.trim()) {
      throw new Error('Vergi numarası girildiğinde vergi dairesi girmek zorunludur.')
    }
    if (!payload.taxOfficeCity || !payload.taxOfficeCity.trim()) {
      throw new Error('Vergi numarası girildiğinde şirketin bağlı olduğu il seçilmelidir.')
    }
  }

  // Normalize values: empty strings become null to satisfy constraints
  // Ensure username is set (either from payload or keep existing)
  const finalUsername = payload.username?.trim() || currentUsername || null
  const normalizedUsername = finalUsername
  const normalizedCity = payload.city?.trim() || null
  const normalizedBio = payload.bio?.trim() || null
  const normalizedBrandName = payload.brandName?.trim() || null

  const updates: any = {
    full_name: normalizedBrandName,
    username: normalizedUsername,
    city: normalizedCity,
    bio: normalizedBio,
    category: payload.category || null,
    avatar_url: payload.logoUrl,
    social_links: {
      website: websiteResult.normalizedUrl || null,
      linkedin: linkedinResult.normalizedUrl || null,
      instagram: instagramResult.normalizedUrl || null,
      kick: kickResult.normalizedUrl || null,
      twitter: twitterResult.normalizedUrl || null,
      twitch: twitchResult.normalizedUrl || null,
    },
  }

  // Yasal bilgiler yalnızca gönderildiyse değişir (mobil kısmi düzenleme vergi bilgisini göndermez;
  // web formu her zaman gönderir).
  if (payload.companyLegalName !== undefined) {
    updates.company_legal_name = payload.companyLegalName?.trim() || null
  }
  if (payload.taxId !== undefined) {
    updates.tax_id = normalizedTaxId
    updates.tax_office = payload.taxOffice?.trim() || null
    updates.tax_office_city = payload.taxOfficeCity?.trim() || null
  }

  // Update social_links_last_updated if social links changed
  if (socialLinksChanged) {
    updates.social_links_last_updated = new Date().toISOString()
  }

  // Update displayed_badges if provided
  if (payload.displayedBadges !== undefined) {
    updates.displayed_badges = payload.displayedBadges
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id')

  if (updateError) {
    console.error('[updateBrandProfile] Update error:', updateError)
    // Check if it's a unique constraint violation for username
    if (updateError.code === '23505' || updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
    }

    throw new Error('Profil kaydedilemedi. Lütfen tekrar deneyin.')
  }

}
