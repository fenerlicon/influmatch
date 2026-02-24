import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateVerificationCode } from '@/app/actions/social-verification'

/**
 * Creates a Supabase client that validates a Bearer token from the Authorization header.
 * This is needed for mobile clients that send JWT tokens instead of cookies.
 */
function createBearerClient(authHeader: string | null) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        }
    )
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { action, userId, username } = body

        // --- Security: Validate Bearer token and confirm caller is who they claim ---
        const authHeader = request.headers.get('Authorization')
        const bearerClient = createBearerClient(authHeader)

        if (!bearerClient) {
            return NextResponse.json(
                { success: false, error: 'Authorization header eksik veya geçersiz.' },
                { status: 401 }
            )
        }

        const {
            data: { user: callerUser },
            error: authError,
        } = await bearerClient.auth.getUser()

        if (authError || !callerUser) {
            return NextResponse.json(
                { success: false, error: 'Geçersiz veya süresi dolmuş token.' },
                { status: 401 }
            )
        }

        // Caller can only operate on their own userId
        if (callerUser.id !== userId) {
            return NextResponse.json(
                { success: false, error: 'Başka bir kullanıcı adına işlem yapamazsınız.' },
                { status: 403 }
            )
        }

        // --- Service client for privileged DB operations ---
        const adminClient: any = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        if (action === 'generate') {
            // generateVerificationCode uses createSupabaseServerClient (cookie-based),
            // but it doesn't enforce auth at the start — it only needs userId and username.
            const result = await generateVerificationCode(userId, username)
            return NextResponse.json(result)
        }

        if (action === 'verify') {
            return await handleMobileVerify(adminClient, userId)
        }

        return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

async function handleMobileVerify(adminClient: any, userId: string) {
    // Fetch the pending verification record
    const { data: account, error: fetchError } = await adminClient
        .from('social_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'instagram')
        .single()

    if (fetchError || !account) {
        return NextResponse.json({
            success: false,
            error: 'Instagram hesabı bulunamadı. Lütfen önce hesap ekleyin.',
        })
    }

    // Fetch live Instagram data
    const { fetchInstagramData } = await import('@/utils/instagram-service')
    let normalizedData: any
    try {
        normalizedData = await fetchInstagramData(account.username)
    } catch (apiError: any) {
        return NextResponse.json({
            success: false,
            error: `Instagram verisi alınamadı: ${apiError.message}`,
        })
    }

    const igUser = normalizedData.user
    const biography: string = igUser.biography || ''

    // Check verification code in bio (only if not already verified)
    if (!account.is_verified) {
        if (!biography.includes(account.verification_code)) {
            return NextResponse.json({
                success: false,
                error: 'Doğrulama kodu biyografide bulunamadı. Lütfen biyografinize ekleyip tekrar deneyin.',
            })
        }
    }

    const now = new Date().toISOString()

    // Update social_accounts with fresh stats
    const { error: updateError } = await adminClient
        .from('social_accounts')
        .update({
            is_verified: true,
            platform_user_id: String(igUser.id),
            follower_count: igUser.follower_count,
            following_count: igUser.following_count,
            post_count: igUser.media_count,
            has_stats: true,
            stats_payload: {
                follower_count: igUser.follower_count,
                following_count: igUser.following_count,
                post_count: igUser.media_count,
                is_verified: igUser.is_verified,
                is_business_account: igUser.is_business_account,
                external_url: igUser.external_url,
            },
            last_scraped_at: now,
            updated_at: now,
        })
        .eq('id', account.id)

    if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message })
    }

    // Award verified-account badge
    await adminClient
        .from('user_badges')
        .upsert(
            { user_id: userId, badge_id: 'verified-account', earned_at: now },
            { onConflict: 'user_id,badge_id' }
        )

    return NextResponse.json({ success: true, message: 'Mobil Instagram doğrulaması başarılı.' })
}
