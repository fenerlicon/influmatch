import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { listDiscoverProfiles } from '@/lib/profile-reads'

export const dynamic = 'force-dynamic'

/**
 * Keşif listesi (mobil Keşfet ve marka ana sayfasındaki öne çıkanlar). Web keşfiyle aynı kural (lib/profile-reads.ts):
 * onaysız marka { locked: true }; ücretsiz marka (sınırlar açıkken) { limited: true, profilesPerSpin, windowHours, spin,
 * profiles } (yalnızca çarktakiler); diğerleri { limited: false, profiles }. Her profilde doğrulanmış social_accounts.
 * ?limit= (en fazla 500).
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const limit = Number(new URL(request.url).searchParams.get('limit')) || undefined
  const result = await listDiscoverProfiles(ctx.supabase, ctx.user.id, { limit })
  return mobileJson(result, 'error' in result ? 500 : 200)
}
