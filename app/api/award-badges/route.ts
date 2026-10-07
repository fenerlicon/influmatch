import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'

export async function POST(request: NextRequest) {
  try {
    // Kullanıcı yalnızca kendi rozetlerini değerlendirtebilir; başkası için admin gerekir.
    // Rozet kuralları sunucuda DB verisinden hesaplanır (utils/badgeAwarding.ts), istemciye güvenilmez.
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
    }

    const { userId } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
    }

    if (userId !== user.id) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Bu işlem için admin yetkisi gerekiyor.' }, { status: 403 })
      }
    }

    await awardBadgesForUser(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[award-badges] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to award badges' },
      { status: 500 },
    )
  }
}
