import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  RECOVERY_COOKIE,
  RECOVERY_MAX_AGE,
  RESET_REQUEST_COOKIE,
  recoveryCookieOptions,
} from '@/lib/password-recovery'

// Route Handler istemcisi oturum çerezlerini yazar; şifre sıfırlamada kullanıcı oturum açık
// olarak yeni şifre ekranına geçer (createSupabaseServerClient çerez yazamaz).

/** Şifre sıfırlama bağlantısı: oturum açık kalır, kullanıcı yeni şifre ekranına gider. */
function redirectToPasswordUpdate(origin: string, userId: string) {
  const response = NextResponse.redirect(new URL('/auth/update-password', origin))
  response.cookies.set(RECOVERY_COOKIE, userId, recoveryCookieOptions(RECOVERY_MAX_AGE))
  response.cookies.delete(RESET_REQUEST_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)

  // Not: URL token içerir (code, token_hash, access/refresh token); asla loglanmamalı.

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

  // Handle code exchange (PKCE flow)
  const code = requestUrl.searchParams.get('code')
  if (code) {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    // PKCE kodu kayıt doğrulamasıyla aynı biçimde gelir; sıfırlama talebini talep anında
    // bırakılan çerezden anlarız (bkz. lib/password-recovery.ts).
    if (!error && data.user && request.cookies.get(RESET_REQUEST_COOKIE)) {
      return redirectToPasswordUpdate(requestUrl.origin, data.user.id)
    }

    if (!error) {
      // PKCE kodu yalnızca isteği başlatan tarayıcıdaki doğrulayıcı çerezle çalışır; başkasının
      // bağlantısıyla oturum açtırılamaz. Bu yüzden oturum açık bırakılır ve kullanıcı kodla
      // doğrulamadaki gibi devam eder (dashboard, profil eksikse onboarding'e yönlendirir).
      // token_hash / access_token yolları aşağıda oturumu kapatmaya devam eder (giriş CSRF'i).
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
    } else {
      console.error('[auth/callback] Code exchange error:', error)
      return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
    }
  }

  const supabase = createSupabaseServerClient()

  // Handle email confirmation with token_hash (OTP method)
  if (token_hash && type) {
    const { error: verifyError, data } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!verifyError && type === 'recovery' && data.user) {
      return redirectToPasswordUpdate(requestUrl.origin, data.user.id)
    }

    if (!verifyError) {
      // Email verified successfully - clear session and redirect to login
      // User needs to login again after email verification
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?verified=true', requestUrl.origin))
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
      // Email verified successfully - but user needs to login again
      // Clear the session and redirect to login with success message
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?verified=true', requestUrl.origin))
    } else {
      console.error('[auth/callback] Session set error:', sessionError)
      return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
    }
  }

  // If no valid parameters, redirect to login with error
  console.error('[auth/callback] No valid verification parameters found.')
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

