// @supabase/auth-helpers-nextjs oturumu çereze JSON dizi olarak yazıyordu:
//   [access_token, refresh_token, provider_token, provider_refresh_token, factors]
// @supabase/ssr ise oturum nesnesi bekliyor; diziyi geçersiz sayıp siliyor, yani geçişte
// giriş yapmış herkesin oturumu kapanırdı. Middleware her istekte eski biçimi görürse
// oturumu nesneye çevirip çerezi yeni biçimde (base64-) yeniden yazar.
// Edge çalışma ortamında da çalışır (Buffer kullanılmaz).

import { createChunks, stringToBase64URL } from '@supabase/ssr'

export type CookiePair = { name: string; value: string }

export function supabaseStorageKey(supabaseUrl: string) {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
}

function readCombinedValue(cookies: CookiePair[], key: string): string | null {
  const byName = new Map(cookies.map((cookie) => [cookie.name, cookie.value]))
  const single = byName.get(key)
  if (single) return single

  const parts: string[] = []
  for (let i = 0; ; i++) {
    const part = byName.get(`${key}.${i}`)
    if (part === undefined) break
    parts.push(part)
  }
  return parts.length > 0 ? parts.join('') : null
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/** Eski dizi biçimindeki oturumu @supabase/ssr'ın okuyacağı nesneye çevirir; değilse null. */
export function legacySessionToObject(value: string): Record<string, any> | null {
  if (value.startsWith('base64-')) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') return null

  const [accessToken, refreshToken, providerToken, providerRefreshToken, factors] = parsed
  const claims = decodeJwtPayload(accessToken)
  if (!claims || typeof claims.exp !== 'number' || typeof claims.sub !== 'string') return null

  const { exp, sub, ...userClaims } = claims
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    provider_token: providerToken ?? null,
    provider_refresh_token: providerRefreshToken ?? null,
    token_type: 'bearer',
    expires_at: exp,
    expires_in: exp - Math.round(Date.now() / 1000),
    user: { id: sub, factors: factors ?? null, ...userClaims },
  }
}

/**
 * Çerezlerde eski biçimde bir oturum varsa yazılacak yeni parçaları ve silinecek eski
 * çerez adlarını döndürür. Dönüşüm gerekmiyorsa null.
 */
export function migrateLegacySessionCookies(cookies: CookiePair[], key: string) {
  const combined = readCombinedValue(cookies, key)
  if (!combined) return null

  const session = legacySessionToObject(combined)
  if (!session) return null

  const set = createChunks(key, `base64-${stringToBase64URL(JSON.stringify(session))}`)
  const setNames = new Set(set.map((chunk) => chunk.name))
  const remove = cookies
    .map((cookie) => cookie.name)
    .filter((name) => (name === key || name.startsWith(`${key}.`)) && !setNames.has(name))
    .filter((name) => !name.endsWith('-code-verifier'))

  return { set, remove }
}
