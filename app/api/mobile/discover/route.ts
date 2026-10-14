import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { listDiscoverProfiles } from '@/lib/profile-reads'
import { parseDiscoverFilters } from '@/lib/discover-filters'

export const dynamic = 'force-dynamic'

/**
 * Keşif listesi (mobil Keşfet ve marka ana sayfasındaki öne çıkanlar). Web keşfiyle aynı kural (lib/profile-reads.ts):
 * onaysız marka { locked: true }; ücretsiz marka (sınırlar açıkken) { limited: true, profilesPerSpin, windowHours, spin,
 * profiles } (yalnızca çarktakiler); diğerleri { limited: false, profiles }. Her profilde doğrulanmış social_accounts.
 * ?limit= (en fazla 500). Filtreler (lib/discover-filters.ts, sunucuda uygulanır): ?city=, ?platform=instagram|tiktok,
 * ?creatorType=influencer|ugc, ?minFollowers=, ?maxFollowers=, ?minEngagement=, ?maxEngagement= (yüzde),
 * ?sort=followers_desc|followers_asc|engagement_desc; Spotlight Pro'da ?withData=1, ?blueTick=1 (yanıtta proFilters).
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const params = new URL(request.url).searchParams
  const limit = Number(params.get('limit')) || undefined
  const result = await listDiscoverProfiles(ctx.supabase, ctx.user.id, { limit, filters: parseDiscoverFilters(params) })
  return mobileJson(result, 'error' in result ? 500 : 200)
}
