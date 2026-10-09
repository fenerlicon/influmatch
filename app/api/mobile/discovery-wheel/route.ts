import type { SupabaseClient } from '@supabase/supabase-js'
import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { canBrandViewInfluencer, getWheelState, spinWheel, type WheelState } from '@/lib/discovery-wheel'

export const dynamic = 'force-dynamic'

// Keşif çarkı (web ile aynı kod: lib/discovery-wheel.ts). Bayrak kapalıyken ve Spotlight markada { limited: false }.

const CARD_COLUMNS = 'id, full_name, username, avatar_url, category, bio, spotlight_active, verification_status, displayed_badges, creator_type'

async function wheelPayload(supabase: SupabaseClient, state: WheelState) {
  if (!state.limited) return { limited: false }
  const ids = state.spin?.influencer_ids ?? []
  let profiles: Record<string, unknown>[] = []
  if (ids.length > 0) {
    const { data } = await supabase
      .from('users')
      .select(CARD_COLUMNS)
      .in('id', ids)
      .eq('role', 'influencer')
      .eq('verification_status', 'verified')
      .eq('is_showcase_visible', true)
    // Çarktaki sıra korunur.
    profiles = (data ?? []).sort((a, b) => ids.indexOf(a.id as string) - ids.indexOf(b.id as string))
  }
  return {
    limited: true,
    profilesPerSpin: state.profilesPerSpin,
    windowHours: state.windowHours,
    spin: state.spin ? { created_at: state.spin.created_at, expires_at: state.spin.expires_at } : null,
    profiles,
  }
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
  return mobileJson(await wheelPayload(ctx.supabase, state))
}

/** Çarkı çevirir (pencere başına bir kez; süresi dolmamış çevirme varsa onu döndürür). */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const result = await spinWheel(ctx.user.id)
  if ('error' in result) return mobileJson({ error: result.error }, 400)
  return mobileJson(await wheelPayload(ctx.supabase, await getWheelState(ctx.user.id)))
}
