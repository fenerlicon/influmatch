import { randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

type OAuthProvider = 'instagram' | 'tiktok'

const cookieName = (provider: OAuthProvider) => `oauth_state_${provider}`

/**
 * OAuth akışını başlatırken rastgele bir state üretir ve httpOnly cookie'ye yazar.
 * Callback'te aynı değer beklenir; böylece saldırgan kendi yetkilendirme kodunu
 * kurbanın oturumuna bağlatamaz (login CSRF).
 */
export function createOAuthState(provider: OAuthProvider) {
  const state = randomBytes(32).toString('hex')
  cookies().set(cookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/api/auth/${provider}`,
    maxAge: 10 * 60,
  })
  return state
}

/** Callback'te gelen state'i cookie ile karşılaştırır ve cookie'yi tek kullanımlık olarak siler. */
export function consumeOAuthState(provider: OAuthProvider, received: string | null) {
  const store = cookies()
  const expected = store.get(cookieName(provider))?.value
  store.delete({ name: cookieName(provider), path: `/api/auth/${provider}` })

  if (!expected || !received || expected.length !== received.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}
