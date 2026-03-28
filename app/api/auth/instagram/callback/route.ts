
import { getMetaTokens, getInstagramBusinessAccount, saveInstagramMetaAccount } from '@/utils/meta-service'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  if (error) {
    console.error('[MetaCallback] OAuth Error:', error, error_description)
    return NextResponse.redirect(new URL('/dashboard/influencer/profile?error=instagram_auth_failed', request.url))
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

    // 1. Exchange code for Meta tokens
    const tokens = await getMetaTokens(code)
    
    // 2. Fetch linked Instagram Business account data
    const igUser = await getInstagramBusinessAccount(tokens.access_token)

    // 3. Save to database
    await saveInstagramMetaAccount(user.id, igUser, tokens)

    // 4. Redirect to dashboard success page
    return NextResponse.redirect(new URL('/dashboard/influencer/profile?success=instagram_connected', request.url))
  } catch (err: any) {
    console.error('[MetaCallback] Exception:', err)
    let errorMessage = err.message || 'Meta API bağlantı hatası.'
    
    // Redirect with error message
    return NextResponse.redirect(new URL(`/dashboard/influencer/profile?error=${encodeURIComponent(errorMessage)}`, request.url))
  }
}
