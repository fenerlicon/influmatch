import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { canBrandViewInfluencer, getWheelState, spinWheel, type WheelState } from '@/lib/discovery-wheel'
import { getWheelProfileCards, wheelPayloadOf } from '@/lib/profile-reads'

export const dynamic = 'force-dynamic'

// Keşif çarkı (web ile aynı kod: lib/discovery-wheel.ts). Bayrak kapalıyken ve Spotlight markada { limited: false }.

// Çarktaki profil kartları sunucuda service role ile okunur (lib/profile-reads.ts, 3.17-S2).
async function wheelPayload(state: WheelState) {
  if (!state.limited) return { limited: false }
  return { ...wheelPayloadOf(state), profiles: await getWheelProfileCards(state) }
}

/**
 * Çark durumu: { limited: false } ya da { limited: true, profilesPerSpin, windowHours, spin, profiles }.
 * ?profileId=<uuid> ile: { limited, allowed } (marka bu profili açabilir mi).
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const state = await getWheelState(ctx.user.id)
  const profileId = new URL(request.url).searchParams.get('profileId')
  if (profileId) {
    const allowed = !state.limited || (await canBrandViewInfluencer(ctx.user.id, profileId, state))
    return mobileJson({
      limited: state.limited,
      allowed,
      profilesPerSpin: state.limited ? state.profilesPerSpin : null,
      windowHours: state.limited ? state.windowHours : null,
      expiresAt: state.limited ? (state.spin?.expires_at ?? null) : null,
    })
  }
  return mobileJson(await wheelPayload(state))
}

/** Çarkı çevirir (pencere başına bir kez; süresi dolmamış çevirme varsa onu döndürür). */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const result = await spinWheel(ctx.user.id)
  if ('error' in result) return mobileJson({ error: result.error }, 400)
  return mobileJson(await wheelPayload(await getWheelState(ctx.user.id)))
}
