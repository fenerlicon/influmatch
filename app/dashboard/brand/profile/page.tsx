export const revalidate = 0
// Vergi levhası PDF okuma bu sayfanın server action'ında (sunucuda) çalışır.
export const maxDuration = 60

import { redirect } from 'next/navigation'
import BrandProfileForm from '@/components/brand/BrandProfileForm'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export default async function BrandProfileSettingsPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: publicProfile, error }, { data: privateProfile }, { data: userBadges }] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, username, city, bio, category, avatar_url, social_links, displayed_badges, role, company_legal_name, tax_id_verified, social_links_last_updated')
      .eq('id', user.id)
      .maybeSingle(),
    // Vergi bilgileri gizli kolonlarda; sadece sahibine açık RPC ile okunur.
    supabase
      .rpc('get_my_private_profile')
      .maybeSingle<{ tax_id: string | null; tax_office: string | null; tax_office_city: string | null }>(),
    supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user.id),
  ])

  // Son vergi levhası doğrulaması (RLS: kullanıcı sadece kendi kayıtlarını görür).
  const { data: latestTaxVerification } = await supabase
    .from('tax_verifications')
    .select('status, reasons, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[BrandProfileSettingsPage] profile load error', error.message)
  }

  const profile = publicProfile
    ? {
        ...publicProfile,
        tax_id: privateProfile?.tax_id ?? null,
        tax_office: privateProfile?.tax_office ?? null,
        tax_office_city: privateProfile?.tax_office_city ?? null,
      }
    : null

  const socialLinks = (profile?.social_links as Record<string, string | null> | null) ?? {}
  const displayedBadges = (profile?.displayed_badges as string[] | null) ?? []
  const availableBadgeIds = userBadges?.map((ub) => ub.badge_id) ?? []

  const initialData = {
    brandName: profile?.full_name ?? '',
    username: profile?.username ?? '',
    city: profile?.city ?? '',
    bio: profile?.bio ?? '',
    category: profile?.category ?? 'tech',
    logoUrl: profile?.avatar_url ?? null,
    website: socialLinks?.website ?? '',
    linkedin: socialLinks?.linkedin ?? '',
    instagram: socialLinks?.instagram ?? '',
    displayedBadges,
    availableBadgeIds,
    companyLegalName: profile?.company_legal_name ?? '',
    taxId: profile?.tax_id ?? '',
    taxIdVerified: profile?.tax_id_verified ?? false,
    socialLinksLastUpdated: profile?.social_links_last_updated ?? null,
    taxOffice: (profile as any)?.tax_office ?? '',
    taxOfficeCity: (profile as any)?.tax_office_city ?? '',
    latestTaxVerification: latestTaxVerification ?? null,
  }

  return (
    <div className="space-y-6">
      <BrandProfileForm initialData={initialData} />
    </div>
  )
}
