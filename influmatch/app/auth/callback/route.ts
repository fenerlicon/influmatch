import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const access_token = requestUrl.searchParams.get('access_token')
  const refresh_token = requestUrl.searchParams.get('refresh_token')

  const supabase = createSupabaseServerClient()

  // Handle email confirmation with token_hash (OTP method)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      // Email verified successfully - redirect directly to onboarding
      // Onboarding page will handle role detection and show appropriate form
      return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
    } else {
      console.error('[auth/callback] OTP verification error:', error)
      return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
    }
  }

  // Handle email confirmation with access_token and refresh_token (magic link method)
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (!sessionError) {
      // Session set successfully, email is confirmed - redirect directly to onboarding
      // Onboarding page will handle role detection and show appropriate form
      return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
    } else {
      console.error('[auth/callback] Session set error:', sessionError)
      return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
    }
  }

  // If no valid parameters, redirect to login with error
  console.error('[auth/callback] No valid verification parameters found')
  return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
}

