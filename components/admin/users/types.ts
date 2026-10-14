import type { AdminTaxVerification } from '@/lib/tax-verification'

/** Admin kullanıcı kartı (lib/user-columns ADMIN_USER_SELECT + vergi levhası doğrulaması). */
export interface AdminUser {
  id: string
  full_name: string | null
  email: string | null
  role: 'influencer' | 'brand' | null
  avatar_url: string | null
  username: string | null
  social_links: Record<string, string | null> | null
  verification_status: 'pending' | 'verified' | 'rejected'
  admin_notes: string | null
  created_at: string
  bio: string | null
  category: string | null
  city: string | null
  tax_id?: string | null
  company_legal_name?: string | null
  tax_office?: string | null
  tax_office_city?: string | null
  spotlight_active?: boolean | null
  spotlight_plan?: string | null
  spotlight_expires_at?: string | null
  displayed_badges?: string[] | null
  tax_id_verified?: boolean | null
  email_verified_at?: string | null
  blue_tick_override?: 'granted' | 'revoked' | null
  tax_verification?: AdminTaxVerification | null
  corporate_email?: string | null
  corporate_email_verified_at?: string | null
}

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'website'

export function socialLink(user: AdminUser, platform: SocialPlatform) {
  return user.social_links?.[platform] || null
}

/** Profildeki kullanıcı adı / bağlantı → tıklanabilir adres. */
export function socialUrl(link: string | null, platform: SocialPlatform) {
  if (!link) return null
  if (link.startsWith('http')) return link
  if (platform === 'instagram') return `https://instagram.com/${link.replace('@', '').replace('https://instagram.com/', '')}`
  if (platform === 'tiktok') return `https://tiktok.com/@${link.replace('@', '').replace('https://tiktok.com/@', '')}`
  if (platform === 'youtube') return link.startsWith('@') ? `https://youtube.com/${link}` : link
  return `https://${link}`
}

export function socialCount(user: AdminUser) {
  return Object.values(user.social_links ?? {}).filter((link) => link && link.trim().length > 0).length
}

/** Onay öncesi profilde eksik olanlar. */
export function missingInfo(user: AdminUser) {
  const missing: string[] = []
  if (socialCount(user) === 0) missing.push('Sosyal medya hesabı')
  if (!user.bio) missing.push('Biyografi')
  if (!user.category) missing.push('Kategori')
  if (!user.city) missing.push('Şehir')
  if (!user.avatar_url) missing.push('Profil fotoğrafı')
  return missing
}

/** Rol için tik rozeti: influencer mavi tik, marka sarı tik (Resmi İşletme). */
export function hasTick(user: AdminUser) {
  return user.role === 'brand'
    ? (user.displayed_badges ?? []).includes('official-business')
    : (user.displayed_badges ?? []).includes('verified-account')
}

export const displayName = (user: Pick<AdminUser, 'full_name' | 'username' | 'email'>) =>
  user.full_name || (user.username ? `@${user.username}` : user.email) || 'İsimsiz'

export const formatDay = (value: string) =>
  new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
