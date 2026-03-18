
import { getTikTokTokens, getTikTokUserProfile, saveTikTokAccount } from '@/utils/tiktok-service'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  if (error) {
    console.error('[TikTokCallback] OAuth Error:', error, error_description)
    return NextResponse.redirect(new URL('/dashboard/influencer/profile?error=tiktok_auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/influencer/profile?error=missing_code', request.url))
  }

  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // 1. Exchange code for tokens
    const tokens = await getTikTokTokens(code)
    const accessToken = tokens.access_token

    // 2. Fetch user profile data
    const tiktokUser = await getTikTokUserProfile(accessToken)

    // 3. Save to database
    await saveTikTokAccount(user.id, tiktokUser, tokens)

    // 4. Redirect to dashboard success page
    return NextResponse.redirect(new URL('/dashboard/influencer/profile?success=tiktok_connected', request.url))
  } catch (err: any) {
    console.error('[TikTokCallback] Exception:', err)
    return NextResponse.redirect(new URL(`/dashboard/influencer/profile?error=${encodeURIComponent(err.message)}`, request.url))
  }
}
