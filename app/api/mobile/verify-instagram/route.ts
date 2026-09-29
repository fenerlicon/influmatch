import { NextResponse } from 'next/server'
import { getBearerUser } from '@/lib/mobile-auth'
import { issueVerificationCode, refreshInstagramAccount } from '@/lib/social-stats'

export async function POST(request: Request) {
    try {
        const callerUser = await getBearerUser(request)
        if (!callerUser) {
            return NextResponse.json(
                { success: false, error: 'Geçersiz veya süresi dolmuş oturum.' },
                { status: 401 }
            )
        }

        const { action, userId, username } = await request.json()

        // Kullanıcı sadece kendi hesabı adına işlem yapabilir
        if (userId && userId !== callerUser.id) {
            return NextResponse.json(
                { success: false, error: 'Başka bir kullanıcı adına işlem yapamazsınız.' },
                { status: 403 }
            )
        }

        if (action === 'generate') {
            if (typeof username !== 'string') {
                return NextResponse.json({ success: false, error: 'Kullanıcı adı gerekli.' }, { status: 400 })
            }
            return NextResponse.json(await issueVerificationCode(callerUser.id, 'instagram', username))
        }

        if (action === 'verify') {
            return NextResponse.json(await refreshInstagramAccount(callerUser.id))
        }

        return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 })
    } catch (error) {
        console.error('[mobile/verify-instagram] Error:', error)
        return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 })
    }
}
