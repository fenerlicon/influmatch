import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/admin', '/onboarding', '/profile']
const AUTH_ROUTES = ['/login', '/signup', '/signup-role']

export async function middleware(req: NextRequest) {
  // Sunucu layout'ları (ör. marka doğrulama kilidi) istenen yolu bu başlıktan okur.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session cookie (required for SSR)
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // Redirect unauthenticated users away from protected routes
  if (!session && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages (login, signup)
  if (session && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.txt).*)'],
}
