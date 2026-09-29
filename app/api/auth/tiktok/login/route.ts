
import { getTikTokAuthUrl } from '@/utils/tiktok-service'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { createOAuthState } from '@/lib/oauth-state'

/**
 * Initiates the TikTok OAuth login flow
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  const state = createOAuthState('tiktok')
  const authUrl = getTikTokAuthUrl(state)

  return NextResponse.redirect(new URL(authUrl))
}
