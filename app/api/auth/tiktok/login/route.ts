
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

  // Resmi bağlantı henüz açık değil (arayüzde "Çok Yakında"); doğrudan URL ile başlatılmasın.
  if (process.env.SOCIAL_OAUTH_ENABLED !== 'true') {
    return NextResponse.redirect(new URL('/dashboard/influencer/profile?error=oauth_disabled', process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net'))
  }

  const state = createOAuthState('tiktok')
  const authUrl = getTikTokAuthUrl(state)

  return NextResponse.redirect(new URL(authUrl))
}
