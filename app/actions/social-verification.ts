'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateVerificationCode(userId: string, username: string) {
    const supabase = createSupabaseServerClient()

    try {
        // Generate a random 6-digit code with prefix
        const code = `IM-${Math.floor(100000 + Math.random() * 900000)}`

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
        const rapidApiKey = process.env.RAPIDAPI_KEY

        if (!rapidApiKey) {
            console.error('RAPIDAPI_KEY is missing')
            return { success: false, error: 'API anahtarı eksik.' }
        }

        // 2. API REQUEST: Get User Info & Media (Single Request)
        // Endpoint: /instagram/user/get_web_profile_info (POST)
        const response = await fetch('https://starapi1.p.rapidapi.com/instagram/user/get_web_profile_info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-key': rapidApiKey,
                'x-rapidapi-host': 'starapi1.p.rapidapi.com'
            },
            body: JSON.stringify({ username: username })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('StarAPI Error:', errorText)
            return { success: false, error: `API hatası: ${errorText}` }
        }

        const data = await response.json()

        // Parse Web Profile Info Structure
        // Structure: root -> response -> body -> data -> user
        const user = data?.response?.body?.data?.user

        if (!user) {
            console.error('StarAPI: User object not found in response', JSON.stringify(data, null, 2))
            return { success: false, error: 'Veri ayrıştırma hatası.' }
        }

        const biography = user.biography || ''
        const platformUserId = user.id
        const followerCount = user.edge_followed_by?.count || 0
        const followingCount = user.edge_follow?.count || 0
        const postCount = user.edge_owner_to_timeline_media?.count || 0
        const isVerified = user.is_verified || false
        const categoryName = user.category_name || null
        const isBusinessAccount = user.is_business_account || false
        const externalUrl = user.external_url || null

        // Check verification code
        if (!biography.includes(verificationCode)) {
            return { success: false, error: 'Doğrulama kodu biyografide bulunamadı.' }
        }

        // Calculate Stats from Timeline Media
        let avgLikes = 0
        let avgComments = 0
        let avgViews = 0
        let engagementRate = 0
        let averageIntervalDays = 0

        const edges = user.edge_owner_to_timeline_media?.edges || []
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
                // Sort by date descending (just in case, though usually API returns sorted)
                const sortedPosts = [...recentPosts].sort((a: any, b: any) => b.taken_at_timestamp - a.taken_at_timestamp)

                const newestDate = sortedPosts[0].taken_at_timestamp
                const oldestDate = sortedPosts[sortedPosts.length - 1].taken_at_timestamp

                // Difference in seconds
                const diffSeconds = newestDate - oldestDate
                // Difference in days
                const diffDays = diffSeconds / (60 * 60 * 24)

                // Average interval
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

        const { error: updateError } = await supabase
            .from('social_accounts')
            .update({
                is_verified: true,
                platform_user_id: platformUserId,
                follower_count: followerCount,
                engagement_rate: engagementRate,
                has_stats: true,
                stats_payload: statsPayload,
                last_scraped_at: new Date().toISOString(),
            })
            .eq('id', account.id)

        if (updateError) {
            console.error('Error updating verification status:', updateError)
            return { success: false, error: 'Güncelleme hatası.' }
        }

        // 5. Award "Data Verified" Badge
        const { error: badgeError } = await supabase
            .from('user_badges')
            .upsert(
                {
                    user_id: userId,
                    badge_id: 'data-verified',
                    awarded_at: new Date().toISOString()
                },
                {
                    onConflict: 'user_id, badge_id'
                }
            )

        if (badgeError) {
            console.error('Error awarding data-verified badge:', badgeError)
            // We don't fail the verification if badge awarding fails, but we log it.
        }

        revalidatePath('/dashboard/profile')
        return {
            success: true,
            message: 'Hesap başarıyla doğrulandı.',
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
