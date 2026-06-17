import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateTikTokVerificationCode, verifyTikTokAccount } from '@/app/actions/social-verification'

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

        if (callerUser.id !== userId) {
            return NextResponse.json(
                { success: false, error: 'Başka bir kullanıcı adına işlem yapamazsınız.' },
                { status: 403 }
            )
        }

        if (action === 'generate') {
            const result = await generateTikTokVerificationCode(userId, username)
            return NextResponse.json(result)
        }

        if (action === 'verify') {
            const result = await verifyTikTokAccount(userId)
            return NextResponse.json(result)
        }

        return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
