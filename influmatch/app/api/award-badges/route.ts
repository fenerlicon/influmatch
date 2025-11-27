import { NextRequest, NextResponse } from 'next/server'
import { awardBadgesForUser } from '@/utils/badgeAwarding'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
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

