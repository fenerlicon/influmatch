import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = createSupabaseServerClient()

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      // Email verified successfully
      return NextResponse.redirect(new URL(`/auth/verify-success?next=${encodeURIComponent(next)}`, requestUrl.origin))
    }
  }

  // If verification failed or no token, redirect to login with error
  return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin))
}

