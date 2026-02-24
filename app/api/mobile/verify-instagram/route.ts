import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Mobile Instagram connect endpoint.
 * Action: 'connect' — simply takes a username, fetches public profile data
 * via RocketAPI/StarAPI, and saves it. No bio verification needed.
 */
function createBearerClient(authHeader: string | null) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { action, userId, username } = body

        // Auth check
        const authHeader = request.headers.get('Authorization')
        const bearerClient = createBearerClient(authHeader)
        if (!bearerClient) {
            return NextResponse.json({ success: false, error: 'Authorization header eksik.' }, { status: 401 })
        }

        const { data: { user: callerUser }, error: authError } = await bearerClient.auth.getUser()
        if (authError || !callerUser) {
            return NextResponse.json({ success: false, error: 'Geçersiz token.' }, { status: 401 })
        }
        if (callerUser.id !== userId) {
            return NextResponse.json({ success: false, error: 'Yetkisiz işlem.' }, { status: 403 })
        }

        // Service client
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // ── ACTION: connect ───────────────────────────────────────────────────
        if (action === 'connect') {
            if (!username?.trim()) {
                return NextResponse.json({ success: false, error: 'Kullanıcı adı boş olamaz.' })
            }

            const cleanUsername = username.trim().replace(/^@/, '').toLowerCase()

            // Fetch public profile via existing service
            const { fetchInstagramData } = await import('@/utils/instagram-service')
            let normalizedData: any
            try {
                normalizedData = await fetchInstagramData(cleanUsername)
            } catch (apiError: any) {
                return NextResponse.json({
                    success: false,
                    error: `Instagram profili bulunamadı veya hesap gizli: ${apiError.message}`
                })
            }

            const igUser = normalizedData.user
            const edges = normalizedData.recent_posts || []

            // Calculate basic stats
            const recentPosts = edges.slice(0, 6).map((e: any) => e.node)
            let avgLikes = 0, avgComments = 0, avgViews = 0, engagementRate = 0

            if (recentPosts.length > 0) {
                const totalLikes = recentPosts.reduce((s: number, p: any) => s + (p.edge_liked_by?.count || 0), 0)
                const totalComments = recentPosts.reduce((s: number, p: any) => s + (p.edge_media_to_comment?.count || 0), 0)
                const videoPosts = recentPosts.filter((p: any) => p.is_video)
                if (videoPosts.length > 0) {
                    avgViews = Math.round(videoPosts.reduce((s: number, p: any) => s + (Number(p.video_view_count) || 0), 0) / videoPosts.length)
                }
                avgLikes = Math.round(totalLikes / recentPosts.length)
                avgComments = Math.round(totalComments / recentPosts.length)
                if (igUser.follower_count > 0) {
                    const raw = ((avgLikes + avgComments) / igUser.follower_count) * 100
                    engagementRate = Math.min(parseFloat(raw.toFixed(2)), 999.99)
                }
            }

            const now = new Date().toISOString()

            // Upsert social_accounts
            const { error: upsertError } = await adminClient
                .from('social_accounts')
                .upsert(
                    {
                        user_id: userId,
                        platform: 'instagram',
                        username: cleanUsername,
                        platform_user_id: String(igUser.id),
                        is_verified: true,
                        follower_count: igUser.follower_count,
                        engagement_rate: engagementRate,
                        has_stats: recentPosts.length > 0,
                        stats_payload: {
                            following_count: igUser.following_count,
                            post_count: igUser.media_count,
                            avg_likes: avgLikes,
                            avg_comments: avgComments,
                            avg_views: avgViews,
                            is_verified: igUser.is_verified,
                            is_business_account: igUser.is_business_account,
                            external_url: igUser.external_url,
                            category_name: igUser.category_name,
                            analyzed_post_urls: recentPosts.map((p: any) => `https://www.instagram.com/p/${p.shortcode}/`),
                        },
                        last_scraped_at: now,
                        updated_at: now,
                    },
                    { onConflict: 'user_id,platform' }
                )

            if (upsertError) {
                console.error('[mobile/verify-instagram] upsert error:', upsertError)
                return NextResponse.json({ success: false, error: 'Veritabanı hatası: ' + upsertError.message })
            }

            // Also update users.social_links for cross-reference
            await adminClient
                .from('users')
                .update({ social_links: { instagram: cleanUsername } })
                .eq('id', userId)

            return NextResponse.json({
                success: true,
                message: `@${cleanUsername} başarıyla bağlandı!`,
                data: {
                    username: cleanUsername,
                    follower_count: igUser.follower_count,
                    engagement_rate: engagementRate,
                    avatar: igUser.profile_pic_url,
                }
            })
        }

        // Legacy actions (kept for backwards compat, but simplify to just return error)
        if (action === 'generate' || action === 'verify') {
            return NextResponse.json({
                success: false,
                error: 'Bu doğrulama yöntemi artık kullanımda değil. Lütfen uygulamayı güncelleyin.'
            })
        }

        return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 })

    } catch (error: any) {
        console.error('[mobile/verify-instagram] exception:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
