import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { migrateLegacySessionCookies, supabaseStorageKey } from '@/lib/supabase/legacy-session-cookie'

const PROTECTED_ROUTES = ['/dashboard', '/admin', '/onboarding', '/profile']
const AUTH_ROUTES = ['/login', '/signup', '/signup-role']

// @supabase/ssr ile aynı varsayılanlar (tarayıcı istemcisi çerezi okuyabilmeli).
const SESSION_COOKIE_OPTIONS: CookieOptions = { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 400 * 24 * 60 * 60 }

type PendingCookie = { name: string; value: string; options: CookieOptions }

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const pendingCookies: PendingCookie[] = []

  // Eski auth-helpers çerezi (JSON dizi) yeni biçime çevrilir; aksi halde @supabase/ssr
  // oturumu geçersiz sayıp siler ve kullanıcı çıkış yapmış olur.
  const migration = migrateLegacySessionCookies(req.cookies.getAll(), supabaseStorageKey(supabaseUrl))
  if (migration) {
    migration.remove.forEach((name) => {
      req.cookies.delete(name)
      pendingCookies.push({ name, value: '', options: { ...SESSION_COOKIE_OPTIONS, maxAge: 0 } })
    })
    migration.set.forEach(({ name, value }) => {
      req.cookies.set(name, value)
      pendingCookies.push({ name, value, options: SESSION_COOKIE_OPTIONS })
    })
  }

  // Sunucu layout'ları (ör. marka doğrulama kilidi) istenen yolu bu başlıktan okur.
  // İstek başlıkları her seferinde güncel çerezlerle yeniden kurulur.
  const buildResponse = () => {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', pathname)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  let res = buildResponse()

  const supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value)
          pendingCookies.push({ name, value, options })
        })
        res = buildResponse()
      },
    },
  })

  // Oturumu okur ve süresi dolmak üzereyse yeniler (yeni çerezler setAll ile yanıta yazılır).
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Yönlendirmelerde de yenilenen/dönüştürülen çerezler kaybolmasın.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    pendingCookies.forEach(({ name, value, options }) => redirect.cookies.set(name, value, options))
    return redirect
  }

  // Redirect unauthenticated users away from protected routes
  if (!session && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirectedFrom', pathname)
    return redirectTo(loginUrl)
  }

  // Redirect authenticated users away from auth pages (login, signup)
  if (session && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return redirectTo(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.txt).*)'],
}
