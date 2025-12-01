import { redirect } from 'next/navigation'
import BrandDiscoverGrid from '@/components/dashboard/BrandDiscoverGrid'
import type { DiscoverInfluencer } from '@/components/dashboard/BrandDiscoverGrid'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export default async function InfluencerDiscoverPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Fetch Users
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, category, username, spotlight_active, displayed_badges, verification_status')
    .eq('role', 'influencer')
    .eq('verification_status', 'verified')
    .eq('is_showcase_visible', true)
    .order('spotlight_active', { ascending: false })
    .order('full_name', { ascending: true })

  if (error) {
    console.error('[InfluencerDiscoverPage] load error', error.message)
  }

  // 2. Fetch Social Accounts separately to avoid relationship errors
  const userIds = (data ?? []).map(u => u.id)
  let socialAccountsMap: Record<string, any[]> = {}

  if (userIds.length > 0) {
    const { data: socialData } = await supabase
      .from('social_accounts')
      .select('user_id, platform, follower_count, engagement_rate, stats_payload')
      .in('user_id', userIds)

    if (socialData) {
      socialData.forEach((account) => {
        if (!socialAccountsMap[account.user_id]) {
          socialAccountsMap[account.user_id] = []
        }
        socialAccountsMap[account.user_id].push(account)
      })
    }
  }

  // 3. Merge Data
  const influencers: DiscoverInfluencer[] = (data ?? []).map((user) => {
    let displayedBadges: string[] | null = null

    if (user.displayed_badges) {
      if (Array.isArray(user.displayed_badges)) {
        displayedBadges = user.displayed_badges
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      } else if (typeof user.displayed_badges === 'string') {
        try {
          const parsed = JSON.parse(user.displayed_badges)
          if (Array.isArray(parsed)) {
            displayedBadges = parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
          }
        } catch {
          displayedBadges = null
        }
      }
    }

    const userAccounts = socialAccountsMap[user.id] || []
    const socialAccount = userAccounts.length > 0 ? userAccounts[0] : null

    let stats = undefined
    if (socialAccount) {
      const payload = socialAccount.stats_payload as any
      stats = {
        followers: socialAccount.follower_count ? `${socialAccount.follower_count}` : '0',
        engagement: socialAccount.engagement_rate ? `${socialAccount.engagement_rate}%` : '0%',
        avg_likes: payload?.avg_likes ? `${payload.avg_likes}` : undefined,
        avg_views: payload?.avg_views ? `${payload.avg_views}` : undefined,
        avg_comments: payload?.avg_comments ? `${payload.avg_comments}` : undefined,
      }
    }

    return {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      category: user.category,
      avatar_url: user.avatar_url,
      spotlight_active: user.spotlight_active,
      displayed_badges: displayedBadges,
      verification_status: user.verification_status as 'pending' | 'verified' | 'rejected' | null,
      platform: socialAccount?.platform as any,
      stats: stats
    }
  })

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Vitrin</p>
        <h1 className="mt-2 text-2xl font-semibold">Topluluğu keşfet</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-300">
          Diğer influencer profillerini incele, Spotlight vitrininde nasıl göründüğünü karşılaştır ve profilini optimize
          etmek için ilham al.
        </p>
      </header>

      {error ? (
        <div className="rounded-3xl border border-red-400/30 bg-red-950/30 p-6 text-sm text-red-200">
          Influencer listesi yüklenemedi. Lütfen sayfayı yenileyin.
        </div>
      ) : (
        <BrandDiscoverGrid influencers={influencers} currentUserId={user.id} />
      )}
    </div>
  )
}
