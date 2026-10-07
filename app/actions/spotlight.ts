'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { DiscoverInfluencer } from '@/types/influencer'
import { syncBlueTick } from '@/lib/blue-tick'
import { expireSpotlights } from '@/lib/spotlight-expiry'

const formatFollowers = (count: number) =>
    count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count >= 1_000 ? `${(count / 1_000).toFixed(1)}K` : String(count)

type VerifiedAccount = {
    user_id: string
    follower_count: number | null
    engagement_rate: number | string | null
    stats_payload: Record<string, any> | null
}

/**
 * Aynı kategorideki, takipçi sayısı ±%30 aralığında olan Spotlight üyelerini döner.
 * İstatistikler doğrulanmış sosyal hesaplardan (en çok takipçili hesap) okunur. Eskiden users tablosunda
 * olmayan instagram_stats alanı okunduğu için takipçi hep 0 çıkıyordu (4.4-S1).
 */
export async function getSimilarInfluencers(baseInfluencerId: string): Promise<{ data: DiscoverInfluencer[], error: string | null }> {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Oturum açmanız gerekiyor.' }

    const { data: baseUser, error: fetchError } = await supabase
        .from('users')
        .select('id, category')
        .eq('id', baseInfluencerId)
        .maybeSingle()
    if (fetchError || !baseUser) {
        return { data: [], error: 'Referans profil bulunamadı' }
    }

    let query = supabase
        .from('users')
        .select('id, full_name, username, category, avatar_url, spotlight_active, verification_status, displayed_badges')
        .neq('id', baseInfluencerId)
        .eq('role', 'influencer')
        .eq('is_showcase_visible', true)
        .eq('spotlight_active', true)
        .limit(50)
    if (baseUser.category) query = query.eq('category', baseUser.category)

    const { data: candidates, error: searchError } = await query
    if (searchError) {
        return { data: [], error: 'Benzer profiller aranırken hata oluştu' }
    }
    if (!candidates?.length) return { data: [], error: null }

    const { data: accounts } = await supabase
        .from('social_accounts')
        .select('user_id, follower_count, engagement_rate, stats_payload')
        .in('user_id', [baseInfluencerId, ...candidates.map((c) => c.id)])
        .eq('is_verified', true)

    // Kullanıcı başına en çok takipçili doğrulanmış hesap
    const primary = new Map<string, VerifiedAccount>()
    for (const account of (accounts ?? []) as VerifiedAccount[]) {
        const current = primary.get(account.user_id)
        if (!current || (account.follower_count ?? 0) > (current.follower_count ?? 0)) primary.set(account.user_id, account)
    }

    const baseFollowers = primary.get(baseInfluencerId)?.follower_count ?? 0
    const toInfluencer = (u: (typeof candidates)[number]): DiscoverInfluencer => {
        const account = primary.get(u.id)
        return {
            id: u.id,
            full_name: u.full_name,
            username: u.username,
            category: u.category,
            avatar_url: u.avatar_url,
            spotlight_active: u.spotlight_active,
            verification_status: u.verification_status,
            displayed_badges: u.displayed_badges,
            stats: account ? {
                followers: formatFollowers(account.follower_count ?? 0),
                engagement: `${Number(account.engagement_rate) || 0}%`,
                avg_likes: account.stats_payload?.avg_likes?.toString(),
                avg_comments: account.stats_payload?.avg_comments?.toString(),
            } : undefined,
        }
    }

    const withStats = candidates.filter((c) => primary.has(c.id))
    if (baseFollowers > 0) {
        const close = withStats
            .map((c) => ({ c, diff: Math.abs((primary.get(c.id)!.follower_count ?? 0) - baseFollowers) / baseFollowers }))
            .filter((x) => x.diff <= 0.3)
            .sort((a, b) => a.diff - b.diff)
            .slice(0, 3)
            .map((x) => toInfluencer(x.c))
        if (close.length) return { data: close, error: null }
    }

    // Takipçi aralığında kimse yoksa aynı kategorideki (istatistiği olan) profiller
    return { data: (withStats.length ? withStats : candidates).slice(0, 3).map(toInfluencer), error: null }
}

export async function activateSpotlightPlan(
    userId: string,
    planTier: 'ibasic' | 'ipro' | 'mbasic' | 'mpro',
    interval: 'mo' | 'yr'
): Promise<{ success: boolean; error: string | null }> {
    // GÜVENLİK MÜHRÜ: Ödeme altyapısı henüz hazır olmadığı için tüm otomatik alımlar kapatıldı.
    // Bu sayede hiç kimse butona basarak bedavaya Premium/Spotlight üyeliği ÇALAMAZ.
    return { 
        success: false, 
        error: 'Ödeme altyapısı güncellenmektedir. Üyelik işlemleri için lütfen destek@influmatch.net ile iletişime geçin.' 
    };
}

/**
 * Oturumdaki kullanıcının Spotlight üyeliği dolmuşsa kapatır. userId parametresi geriye dönük uyum için
 * duruyor; işlem her zaman oturumdaki kullanıcıya uygulanır (başkası adına çağrılamaz).
 */
export async function checkSpotlightStatus(userId: string): Promise<void> {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) return

    const admin = createSupabaseAdminClient()
    if (!admin) return

    const result = await expireSpotlights(admin, { userId: user.id })
    if (result.expired.length || result.unverified.length) {
        await syncBlueTick(user.id, admin)
    }
}

export async function cancelSpotlightPlan(userId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = createSupabaseServerClient()
    const adminSupabase = createSupabaseAdminClient() || supabase

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) return { success: false, error: 'Yetkisiz erişim.' };

    const { error } = await adminSupabase
        .from('users')
        .update({
            spotlight_active: false,
            spotlight_plan: null,
            spotlight_expires_at: null
        })
        .eq('id', userId)

    if (error) {
        console.error('Error cancelling spotlight:', error)
        return { success: false, error: 'Üyelik iptal edilemedi.' }
    }

    // Mavi tik Spotlight üyeliğine bağlı.
    await syncBlueTick(userId)

    return { success: true, error: null }
}
