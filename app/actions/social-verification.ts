'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchInstagramData } from '@/utils/instagram-service'

export async function generateVerificationCode(userId: string, username: string) {
    const supabase = createSupabaseServerClient()

    try {
        // Generate a random 6-digit code with prefix
        const code = `IM-${Math.floor(100000 + Math.random() * 900000)}`

        // Check for duplicate account usage by OTHER users
        const { data: existingAccount } = await supabase
            .from('social_accounts')
            .select('user_id')
            .eq('platform', 'instagram')
            .ilike('username', username)
            .maybeSingle()

        if (existingAccount && existingAccount.user_id !== userId) {
            return {
                success: false,
                error: 'Bu Instagram hesabı sistemde başka bir kullanıcıya bağlı. Güvenlik nedeniyle aynı hesap birden fazla profile bağlanamaz.'
            }
        }

        // Upsert into social_accounts
        const { error } = await supabase
            .from('social_accounts')
            .upsert(
                {
                    user_id: userId,
                    platform: 'instagram',
                    username: username,
                    verification_code: code,
                    is_verified: false,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'user_id, platform',
                }
            )

        if (error) {
            console.error('Error generating verification code:', error)
            return { success: false, error: `Veritabanı hatası: ${error.message || error.details || 'Bilinmeyen hata'}` }
        }

        revalidatePath('/dashboard/profile')
        return { success: true, code }
    } catch (error: any) {
        console.error('Exception generating verification code:', error)
        return { success: false, error: `Beklenmeyen hata: ${error.message || error}` }
    }
}

export async function verifyInstagramAccount(userId: string) {
    const supabase = createSupabaseServerClient()

    try {
        // 0. Security Check: Ensure the requester is the user they claim to be
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser || authUser.id !== userId) {
            return { success: false, error: 'Yetkisiz işlem.' }
        }

        // 1. Get the user's social account record
        const { data: account, error: fetchError } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('user_id', userId)
            .eq('platform', 'instagram')
            .single()

        if (fetchError || !account) {
            return { success: false, error: 'Hesap bulunamadı.' }
        }

        const username = account.username
        const verificationCode = account.verification_code
        // 2. FETCH DATA using Service (StarAPI -> RocketAPI Fallback)
        let normalizedData;
        try {
            normalizedData = await fetchInstagramData(username);
        } catch (apiError: any) {
            console.error('Instagram Service Error:', apiError)

            // Special handling for the empty edges case from StarAPI which is rethrown by service
            // We want to handle this gracefully here as we did before
            if (apiError.message && apiError.message.includes('API Restriction')) {
                // If it's a known restriction error, we proceed with partial data if possible
                // OR we can just return the error to the user if it's a critical failure for verification
                return { success: false, error: 'Instagram verileri çekilemedi. Lütfen daha sonra tekrar deneyin.' }
            }

            return { success: false, error: `Veri çekme hatası: ${apiError.message}` }
        }

        const user = normalizedData.user
        const edges = normalizedData.recent_posts

        const biography = user.biography || ''
        const platformUserId = user.id
        const followerCount = user.follower_count
        const followingCount = user.following_count
        const postCount = user.media_count
        const isVerified = user.is_verified
        const categoryName = user.category_name
        const isBusinessAccount = user.is_business_account
        const externalUrl = user.external_url



        // Check verification code ONLY if not already verified
        // If the user is already verified and just updating, we trust the link (unless we want to force re-verification periodically)
        // For now, let's relax the check for updates to allow easy refresh
        if (!account.is_verified) {
            if (!biography.includes(verificationCode)) {
                return { success: false, error: 'Doğrulama kodu biyografide bulunamadı.' }
            }
        }

        // Calculate Stats from Timeline Media
        let avgLikes = 0
        let avgComments = 0
        let avgViews = 0
        let engagementRate = 0
        let averageIntervalDays = 0

        // 3. Stats Calculation Logic

        // SAFEGUARD: If user has posts but API returns 0 edges, it's an API failure.
        // Preserve old stats instead of zeroing them out or returning error.
        if (postCount > 0 && edges.length === 0) {
            console.warn(`[verifyInstagramAccount] User ${username} has ${postCount} posts but API returned 0 edges. Preserving old stats.`)

            const oldStats = (account.stats_payload as any) || {}
            avgLikes = oldStats.avg_likes || 0
            avgComments = oldStats.avg_comments || 0
            avgViews = oldStats.avg_views || 0
            averageIntervalDays = oldStats.posting_frequency || 0

            // Keep existing engagement rate column value
            engagementRate = account.engagement_rate || 0
        }

        // Processing edges (They are already normalized to contain 'node' in service if using fallback, or raw edges from starapi)
        // Ensure structure is compatible
        const recentPosts = edges.slice(0, 12).map((edge: any) => edge.node)



        if (recentPosts.length > 0) {
            const totalLikes = recentPosts.reduce((sum: number, post: any) => sum + (post.edge_liked_by?.count || 0), 0)
            const totalComments = recentPosts.reduce((sum: number, post: any) => sum + (post.edge_media_to_comment?.count || 0), 0)

            // Calculate views for video posts
            const videoPosts = recentPosts.filter((post: any) => post.is_video)
            if (videoPosts.length > 0) {
                const totalViews = videoPosts.reduce((sum: number, post: any) => sum + (post.video_view_count || 0), 0)
                avgViews = Math.round(totalViews / videoPosts.length)
            }

            avgLikes = Math.round(totalLikes / recentPosts.length)
            avgComments = Math.round(totalComments / recentPosts.length)

            if (followerCount > 0) {
                engagementRate = parseFloat((((avgLikes + avgComments) / followerCount) * 100).toFixed(2))
            }

            // Calculate Posting Frequency (Average days between posts)
            if (recentPosts.length > 1) {
                const sortedPosts = [...recentPosts].sort((a: any, b: any) => b.taken_at_timestamp - a.taken_at_timestamp)
                const newestDate = sortedPosts[0].taken_at_timestamp
                const oldestDate = sortedPosts[sortedPosts.length - 1].taken_at_timestamp
                const diffSeconds = newestDate - oldestDate
                const diffDays = diffSeconds / (60 * 60 * 24)
                averageIntervalDays = Math.round(diffDays / (sortedPosts.length - 1))
            }
        }

        // 4. Update Database
        const statsPayload = {
            avg_likes: avgLikes,
            avg_comments: avgComments,
            avg_views: avgViews,
            following_count: followingCount,
            post_count: postCount,
            is_verified: isVerified,
            category_name: categoryName,
            is_business_account: isBusinessAccount,
            external_url: externalUrl,
            posting_frequency: averageIntervalDays
        }

        const now = new Date().toISOString()

        const { error: updateError } = await supabase
            .from('social_accounts')
            .update({
                is_verified: true,
                platform_user_id: platformUserId,
                follower_count: followerCount,
                engagement_rate: engagementRate,
                has_stats: true,
                stats_payload: statsPayload,
                last_scraped_at: now,
                updated_at: now // Explicitly update updated_at
            })
            .eq('id', account.id)

        if (updateError) {
            console.error('Error updating verification status:', updateError)
            return { success: false, error: 'Güncelleme hatası.' }
        }

        // 5. Award "Verified Account" (Blue Tick) Badge
        const { error: badgeError } = await supabase
            .from('user_badges')
            .upsert(
                {
                    user_id: userId,
                    badge_id: 'verified-account',
                    earned_at: now
                },
                {
                    onConflict: 'user_id, badge_id'
                }
            )

        if (badgeError) {
            console.error('Error awarding verified-account badge:', badgeError)
        }

        // Revalidate relevant paths
        revalidatePath('/dashboard/influencer')
        revalidatePath(`/profile/${account.username}`) // In case they view their own public profile
        revalidatePath('/') // To be safe

        return {
            success: true,
            message: 'Hesap başarıyla güncellendi.',
            data: {
                platform_user_id: platformUserId,
                follower_count: followerCount,
                engagement_rate: engagementRate,
                ...statsPayload
            }
        }

    } catch (error) {
        console.error('Exception verifying instagram account:', error)
        return { success: false, error: 'Genel hata oluştu.' }
    }
}
