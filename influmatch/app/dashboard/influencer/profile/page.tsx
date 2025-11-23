export const revalidate = 0

import { redirect } from 'next/navigation'
import ProfileForm from '@/components/influencer/ProfileForm'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export default async function InfluencerProfileSettingsPage() {
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
      .select('full_name, username, city, bio, category, avatar_url, social_links, displayed_badges, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user.id),
  ])

  if (error) {
    console.error('[InfluencerProfileSettingsPage] profile load error', error.message)
  }

  const displayedBadges = (profile?.displayed_badges as string[] | null) ?? []
  const availableBadgeIds = userBadges?.map((ub) => ub.badge_id) ?? []

  const initialData = {
    fullName: profile?.full_name ?? '',
    username: profile?.username ?? '',
    city: profile?.city ?? '',
    bio: profile?.bio ?? '',
    category: profile?.category ?? 'beauty',
    avatarUrl: profile?.avatar_url ?? null,
    socialLinks: (profile?.social_links as Record<string, string | null>) ?? {},
    displayedBadges,
    availableBadgeIds,
  }

  return (
    <div className="space-y-6">
      <ProfileForm initialData={initialData} />
    </div>
  )
}

