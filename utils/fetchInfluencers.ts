import { createSupabaseServerClient } from '@/utils/supabase/server'
import { profileReader } from '@/lib/profile-reads'
import { type DiscoverInfluencer } from '@/types/influencer'
import { categoryQueryValues, influencerCategoriesForBrand } from '@/lib/category-map'

// `.in(...)` listeleri URL'ye yazıldığı için kimlikler parça parça sorgulanır (3.5-S2).
const ID_CHUNK = 100

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

const USER_COLUMNS = 'id, full_name, avatar_url, category, username, spotlight_active, displayed_badges, verification_status, creator_type, user_badges(badge_id)'

// Başka kullanıcıların satırları istemci oturumuyla okunamaz (3.17-S2); bu fonksiyonlar yalnızca sunucuda, çağıran sayfa
// oturumu ve kuralları (marka onayı, keşif çarkı, Spotlight) uyguladıktan sonra çağrılır. Okuma service role ile
// yapılır ve yalnızca kart alanları seçilir.
export async function getEnrichedInfluencers(filters?: { ids?: string[], limit?: number, requireVerifiedAccount?: boolean }) {
    const supabase = profileReader(createSupabaseServerClient())
    if (!supabase) return []

    const baseQuery = () => supabase
        .from('users')
        .select(USER_COLUMNS)
        .eq('role', 'influencer')
        .eq('verification_status', 'verified')
        .eq('is_showcase_visible', true)

    let data: any[] = []
    if (filters?.ids && filters.ids.length > 0) {
        const ids = Array.from(new Set(filters.ids))
        const results = await Promise.all(chunk(ids, ID_CHUNK).map((part) => baseQuery().in('id', part)))
        for (const result of results) {
            if (result.error) {
                console.error('Error fetching influencers:', result.error)
                return []
            }
            data.push(...(result.data ?? []))
        }
        data.sort((a, b) => Number(!!b.spotlight_active) - Number(!!a.spotlight_active) || String(a.full_name ?? '').localeCompare(String(b.full_name ?? ''), 'tr'))
        if (filters.limit) data = data.slice(0, filters.limit)
    } else {
        let query = baseQuery()
        if (filters?.limit) {
            query = query.limit(filters.limit)
        }
        query = query.order('spotlight_active', { ascending: false }).order('full_name', { ascending: true })
        const result = await query
        if (result.error) {
            console.error('Error fetching influencers:', result.error)
            return []
        }
        data = result.data ?? []
    }

    if (!data || data.length === 0) return []

    // 2. Fetch Social Accounts (Only return verified ones)
    const userIds = data.map(u => u.id)
    const socialResults = await Promise.all(
        chunk(userIds, ID_CHUNK).map((part) => supabase
            .from('social_accounts')
            .select('user_id, platform, follower_count, engagement_rate, stats_payload, is_verified')
            .in('user_id', part)),
    )
    const socialData = socialResults.flatMap((result) => result.data ?? [])

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

    // Keşif listelerinde yalnızca en az bir doğrulanmış sosyal hesabı olanlar gösterilir
    // (hesabı olmayan profil kartta "Pasif" görünüyordu). Kimlikle istenen listeler
    // (favoriler, listeler) markanın kaydettiği herkesi göstermeye devam eder.
    const visibleUsers = filters?.ids && !filters.requireVerifiedAccount
        ? data
        : data.filter((user) => (socialAccountsMap[user.id]?.length ?? 0) > 0)

    // 3. Merge
    const influencers: DiscoverInfluencer[] = visibleUsers.map((user) => {
        // Kartta kullanıcının seçtiği rozetler (displayed_badges) gösterilir, yalnızca kazanılmış
        // olanlar. Seçim yoksa kazanılanların ilk 3'ü. Mavi tik (verified-account) bir durum
        // göstergesi olduğu için seçilmemiş olsa da her zaman eklenir.
        const earned: string[] = Array.isArray(user.user_badges)
            ? user.user_badges.map((ub: any) => ub.badge_id).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            : []
        let chosen: string[] = []
        if (Array.isArray(user.displayed_badges)) {
            chosen = user.displayed_badges.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        } else if (typeof user.displayed_badges === 'string') {
            try {
                const parsed = JSON.parse(user.displayed_badges)
                if (Array.isArray(parsed)) chosen = parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
            } catch {
                chosen = []
            }
        }
        const earnedSet = new Set(earned)
        let selected = (chosen.length > 0 ? chosen.filter((id) => earnedSet.has(id)) : earned).slice(0, 3)
        if (earnedSet.has('verified-account') && !selected.includes('verified-account')) {
            selected = ['verified-account', ...selected]
        }
        const displayedBadges: string[] | null = selected.length > 0 ? selected : null

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

const MAX_AI_CANDIDATES = 200

export async function getAIRecommendations(
    userId: string,
    filterCategory?: string | null,
    limit?: number
): Promise<DiscoverInfluencer[]> {
    const { calculateMatchScore, getMatchReason } = await import('@/utils/matching')

    // Önce marka sektörüne uyan influencer kategorilerinden (lib/category-map.ts) aday kimlikler SQL ile seçilir,
    // ardından zenginleştirilip puanlanır. Aday sayısı sınırlı (sınırsız `.in('id', ids)` yerine).
    const supabase = profileReader(createSupabaseServerClient())
    if (!supabase) return []
    const candidateQuery = () => supabase
        .from('users')
        .select('id')
        .eq('role', 'influencer')
        .eq('verification_status', 'verified')
        .eq('is_showcase_visible', true)
        .neq('id', userId)
        .order('spotlight_active', { ascending: false })
        .limit(MAX_AI_CANDIDATES)

    const targetKeys = influencerCategoriesForBrand(filterCategory)
    let potentialMatches: { id: string }[] | null = null
    if (targetKeys.length > 0) {
        const { data } = await candidateQuery().in('category', categoryQueryValues(targetKeys))
        potentialMatches = data
    }

    // Eşleşen kategori yoksa (ya da sektör her kategoriyle çalışıyorsa) genel havuz; bölüm boş kalmaz.
    if (!potentialMatches || potentialMatches.length === 0) {
        const { data } = await candidateQuery()
        potentialMatches = data
    }

    if (!potentialMatches || potentialMatches.length === 0) return []

    const ids = potentialMatches.map(u => u.id)

    // Yalnızca doğrulanmış sosyal hesabı olanlar önerilir (keşif listesiyle aynı kural).
    const influencers = await getEnrichedInfluencers({ ids, requireVerifiedAccount: true })

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
