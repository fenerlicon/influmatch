export const revalidate = 0

import { redirect } from 'next/navigation'
import ProfileForm from '@/components/influencer/ProfileForm'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import RateCardForm from '@/components/influencer/RateCardForm'
import { getOwnRateCard } from '@/lib/rate-card'
import InstagramConnect from '@/components/dashboard/InstagramConnect'
import TikTokConnect from '@/components/dashboard/TikTokConnect'
import { Award } from 'lucide-react'
import { ButtonLink, Card, CardHeader, PageHeader } from '@/components/ui'

export default async function InfluencerProfileSettingsPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile, error }, { data: userBadges }, { data: socialAccounts }, rateCard] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, username, city, bio, category, avatar_url, social_links, displayed_badges, role, social_links_last_updated, creator_type')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user.id),
    supabase
      .from('social_accounts')
      .select('platform, is_verified, has_stats, username, updated_at')
      .eq('user_id', user.id),
    getOwnRateCard(supabase, user.id),
  ])

  if (error) {
    console.error('[InfluencerProfileSettingsPage] profile load error', error.message)
  }

  const instagram = socialAccounts?.find((a) => a.platform === 'instagram')
  const tiktok = socialAccounts?.find((a) => a.platform === 'tiktok')
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
    creatorType: (profile?.creator_type as 'influencer' | 'ugc' | 'both') ?? 'influencer',
    displayedBadges,
    availableBadgeIds,
    socialLinksLastUpdated: profile?.social_links_last_updated ?? null,
  }

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title="Profilim"
        description="Profil bilgilerin, fiyat kartın ve bağlı hesapların."
        actions={<ButtonLink href="/dashboard/influencer/badges" leftIcon={<Award />}>Rozetler</ButtonLink>}
      />
      <ProfileForm 
        initialData={initialData} 
        connectedPlatforms={socialAccounts?.filter(a => a.is_verified).map(a => a.platform) || []} 
      />
      <RateCardForm initial={rateCard} />

      {/* Bağlı hesaplar: eskiden influencer ana sayfasındaydı (docs/REDESIGN.md) */}
      <Card as="section" id="hesaplar" className="scroll-mt-20">
        <CardHeader title="Bağlı hesaplar" description="Instagram ve TikTok hesaplarını doğrula; istatistikler bu hesaplardan gelir." />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <InstagramConnect
              userId={user.id}
              isVerified={!!instagram?.has_stats}
              initialUsername={instagram?.username}
              lastUpdated={instagram?.updated_at}
            />
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <TikTokConnect userId={user.id} isVerified={!!tiktok?.is_verified} username={tiktok?.username} />
          </div>
        </div>
      </Card>
    </div>
  )
}

