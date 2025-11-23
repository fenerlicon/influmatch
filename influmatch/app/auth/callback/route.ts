import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const access_token = requestUrl.searchParams.get('access_token')
  const refresh_token = requestUrl.searchParams.get('refresh_token')
  
  // Check for error parameters (from URL hash or query params)
  const error = requestUrl.searchParams.get('error') || requestUrl.hash.match(/error=([^&]+)/)?.[1]
  const errorCode = requestUrl.searchParams.get('error_code') || requestUrl.hash.match(/error_code=([^&]+)/)?.[1]
  const errorDescription = requestUrl.searchParams.get('error_description') || requestUrl.hash.match(/error_description=([^&]+)/)?.[1]

  // If there's an error, redirect to login with appropriate message
  if (error) {
    console.error('[auth/callback] Error from Supabase:', { error, errorCode, errorDescription })
    
    let errorMessage = 'verification_failed'
    if (errorCode === 'otp_expired') {
      errorMessage = 'email_link_expired'
    } else if (errorCode === 'access_denied') {
      errorMessage = 'verification_denied'
    }
    
    return NextResponse.redirect(new URL(`/login?error=${errorMessage}`, requestUrl.origin))
  }

  const supabase = createSupabaseServerClient()

  // Handle email confirmation with token_hash (OTP method)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!verifyError) {
      // Email verified successfully - redirect directly to onboarding
      // Onboarding page will handle role detection and show appropriate form
      return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
    } else {
      console.error('[auth/callback] OTP verification error:', verifyError)
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

