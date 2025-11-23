import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  
  // Log all parameters for debugging
  console.log('[auth/callback] Received request:', {
    url: requestUrl.toString(),
    searchParams: Object.fromEntries(requestUrl.searchParams),
    pathname: requestUrl.pathname,
  })
  
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const access_token = requestUrl.searchParams.get('access_token')
  const refresh_token = requestUrl.searchParams.get('refresh_token')
  
  // Check for error parameters (only from query params, hash is client-side only)
  const error = requestUrl.searchParams.get('error')
  const errorCode = requestUrl.searchParams.get('error_code')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // If there's an error in query params, redirect to login with appropriate message
  // Only check for actual error values, not empty strings
  if (error && error.trim() !== '') {
    console.error('[auth/callback] Error from Supabase:', { error, errorCode, errorDescription })
    
    let errorMessage = 'verification_failed'
    if (errorCode === 'otp_expired') {
      errorMessage = 'email_link_expired'
    } else if (error === 'access_denied' || errorCode === 'access_denied') {
      errorMessage = 'verification_denied'
    }
    
    return NextResponse.redirect(new URL(`/login?error=${errorMessage}`, requestUrl.origin))
  }

  const supabase = createSupabaseServerClient()

  // Handle email confirmation with token_hash (OTP method)
  if (token_hash && type) {
    console.log('[auth/callback] Attempting OTP verification with token_hash and type')
    const { error: verifyError, data } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!verifyError) {
      console.log('[auth/callback] OTP verification successful, redirecting to success page')
      // Email verified successfully - redirect to success page
      // Success page will auto-login and redirect to dashboard
      return NextResponse.redirect(new URL('/auth/verify-success', requestUrl.origin))
    } else {
      console.error('[auth/callback] OTP verification error:', verifyError)
      return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
    }
  }

  // Handle email confirmation with access_token and refresh_token (magic link method)
  if (access_token && refresh_token) {
    console.log('[auth/callback] Attempting session set with access_token and refresh_token')
    const { error: sessionError, data: sessionData } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (!sessionError) {
      console.log('[auth/callback] Session set successfully, redirecting to success page')
      // Session set successfully, email is confirmed - redirect to success page
      // Success page will auto-login and redirect to dashboard
      return NextResponse.redirect(new URL('/auth/verify-success', requestUrl.origin))
    } else {
      console.error('[auth/callback] Session set error:', sessionError)
      return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
    }
  }

  // If no valid parameters, redirect to login with error
  console.error('[auth/callback] No valid verification parameters found. URL:', requestUrl.toString())
  console.error('[auth/callback] Available params:', {
    token_hash: !!token_hash,
    type,
    access_token: !!access_token,
    refresh_token: !!refresh_token,
    error,
    errorCode,
  })
  return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
}

