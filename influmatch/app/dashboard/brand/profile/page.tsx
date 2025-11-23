export const revalidate = 0

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

  const [{ data: profile, error }, { data: userBadges }] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, username, city, bio, category, avatar_url, social_links, displayed_badges, role, company_legal_name, tax_id')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user.id),
  ])

  if (error) {
    console.error('[BrandProfileSettingsPage] profile load error', error.message)
  }

  const socialLinks = (profile?.social_links as Record<string, string | null> | null) ?? {}
  const displayedBadges = (profile?.displayed_badges as string[] | null) ?? []
  const availableBadgeIds = userBadges?.map((ub) => ub.badge_id) ?? []

  const initialData = {
    brandName: profile?.full_name ?? '',
    username: profile?.username ?? '',
    city: profile?.city ?? '',
    bio: profile?.bio ?? '',
    category: profile?.category ?? 'Teknoloji',
    logoUrl: profile?.avatar_url ?? null,
    website: socialLinks?.website ?? '',
    linkedin: socialLinks?.linkedin ?? '',
    instagram: socialLinks?.instagram ?? '',
    displayedBadges,
    availableBadgeIds,
    companyLegalName: profile?.company_legal_name ?? '',
    taxId: profile?.tax_id ?? '',
  }

  return (
    <div className="space-y-6">
      <BrandProfileForm initialData={initialData} />
    </div>
  )
}
