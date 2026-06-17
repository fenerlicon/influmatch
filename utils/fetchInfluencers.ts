import { createSupabaseServerClient } from '@/utils/supabase/server'
import { type DiscoverInfluencer } from '@/types/influencer'

export async function getEnrichedInfluencers(filters?: { ids?: string[], limit?: number }) {
    const supabase = createSupabaseServerClient()

    let query = supabase
        .from('users')
        .select('id, full_name, avatar_url, category, username, spotlight_active, displayed_badges, verification_status, creator_type, user_badges(badge_id)')
        .eq('role', 'influencer')
        .eq('verification_status', 'verified')
        .eq('is_showcase_visible', true)

    if (filters?.ids && filters.ids.length > 0) {
        query = query.in('id', filters.ids)
    }

    if (filters?.limit) {
        query = query.limit(filters.limit)
    }

    query = query.order('spotlight_active', { ascending: false }).order('full_name', { ascending: true })

    const { data, error } = await query

    if (error) {
        console.error('Error fetching influencers:', error)
        return []
    }

    if (!data || data.length === 0) return []

    // 2. Fetch Social Accounts (Only return verified ones)
    const userIds = data.map(u => u.id)
    const { data: socialData } = await supabase
        .from('social_accounts')
        .select('user_id, platform, follower_count, engagement_rate, stats_payload, is_verified')
        .in('user_id', userIds)

    const socialAccountsMap: Record<string, any[]> = {}
    if (socialData) {
        socialData.forEach((account) => {
            if (account.is_verified === true) {
                if (!socialAccountsMap[account.user_id]) {
                    socialAccountsMap[account.user_id] = []
                }
                socialAccountsMap[account.user_id].push(account)
            }
        })
    }

    // 3. Merge
    const influencers: DiscoverInfluencer[] = data.map((user) => {
        // Use user_badges if available (real-time), fallback to displayed_badges column
        let displayedBadges: string[] | null = null

        if (user.user_badges && Array.isArray(user.user_badges)) {
            displayedBadges = user.user_badges.map((ub: any) => ub.badge_id).filter(Boolean)
        } else if (user.displayed_badges) {
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
        const platforms = userAccounts.map(a => a.platform as any)
        const primaryAccount = userAccounts.find(a => a.platform === 'instagram') || userAccounts.find(a => a.platform === 'tiktok') || (userAccounts.length > 0 ? userAccounts[0] : null)

        const sortedAccounts = [...userAccounts].sort((a, b) => {
            if (a.platform === 'instagram') return -1
            if (b.platform === 'instagram') return 1
            return 0
        })

        const platforms_data = sortedAccounts.map((sa) => {
            const followersNum = sa.follower_count
            const followersStr = followersNum
                ? followersNum >= 1000000
                    ? `${(followersNum / 1000000).toFixed(1)}M`
                    : followersNum >= 1000
                        ? `${(followersNum / 1000).toFixed(0)}K`
                        : String(followersNum)
                : '0'
            return {
                platform: sa.platform as any,
                follower_count: followersNum,
                followers: followersStr,
                engagement: sa.engagement_rate ? `%${Number(sa.engagement_rate).toFixed(1)}` : '0%'
            }
        })

        let stats = undefined
        if (primaryAccount) {
            const payload = primaryAccount.stats_payload as any
            stats = {
                followers: primaryAccount.follower_count ? `${primaryAccount.follower_count}` : '0',
                engagement: primaryAccount.engagement_rate ? `${primaryAccount.engagement_rate}%` : '0%',
                avg_likes: payload?.avg_likes || payload?.total_likes ? `${payload.avg_likes || payload.total_likes}` : undefined,
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
            platform: primaryAccount?.platform as any,
            platforms: platforms,
            platforms_data: platforms_data,
            stats: stats,
            creator_type: user.creator_type as any
        }
    })

    return influencers
}

export async function getAIRecommendations(
    userId: string,
    filterCategory?: string | null,
    limit?: number
): Promise<DiscoverInfluencer[]> {
    const { calculateMatchScore, getMatchReason } = await import('@/utils/matching')

    // 1. Get Base Influencers (Strict Category Match)
    // If no category is provided, fallback to fetching all (or handle empty case)
    // ideally the caller should provide the category.

    const criteria: any = { limit: 50 } // fetch a pool to sort from
    // We can't easily filter by category in getEnrichedInfluencers raw query without modifying it heavily,
    // so we'll fetch enriched influencers and filter in memory OR modify getEnrichedInfluencers.
    // Let's modify getEnrichedInfluencers to accept partial filters or just filter here efficiently.
    // Actually, let's just fetch a larger pool and filter JS side for now to reuse logic, 
    // OR add a simple category filter param to getEnrichedInfluencers. 
    // For "Strict" matching, SQL filtering is better.

    // Let's rely on getEnrichedInfluencers but filter by IDs if we want strict SQL, 
    // or just fetch all 'verified' + 'visible' and filter.
    // Given the "Strict Relevance" requirement, let's do a direct ID fetch first.

    const supabase = createSupabaseServerClient()
    let query = supabase
        .from('users')
        .select('id')
        .eq('role', 'influencer')
        .eq('is_showcase_visible', true)
        .neq('id', userId)

    if (filterCategory) {
        // approximate strict match
        query = query.ilike('category', `%${filterCategory}%`)
    }

    let { data: potentialMatches } = await query

    // FALLBACK: If strict match returns nothing, fetch top diverse influencers
    // This ensures the homepage section is never empty
    if (!potentialMatches || potentialMatches.length === 0) {
        const { data: fallbackMatches } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'influencer')
            .eq('is_showcase_visible', true)
            .neq('id', userId)
            .order('spotlight_active', { ascending: false }) // Prioritize paid members
            .limit(limit ? limit * 2 : 20) // Fetch a standardized pool

        potentialMatches = fallbackMatches
    }

    if (!potentialMatches || potentialMatches.length === 0) return []

    const ids = potentialMatches.map(u => u.id)

    // Now get enriched data for these IDs
    const influencers = await getEnrichedInfluencers({ ids })

    // Calculate Scores & Sort
    const scored = influencers.map(inf => {
        const score = calculateMatchScore(inf, { targetCategory: filterCategory || undefined })
        const reasons = getMatchReason(inf, { targetCategory: filterCategory || undefined })
        return { ...inf, matchScore: score, matchReasons: reasons }
    })

    // Sort by Score DESC
    scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))

    if (limit) {
        return scored.slice(0, limit)
    }

    return scored
}
