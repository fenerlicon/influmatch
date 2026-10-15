import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getProfileForViewer } from '@/lib/profile-reads'
import { resolveSubscriptionTier } from '@/lib/subscription-tier'
import { canRunAnalysis, generateLocalAnalysis, statsFromSocialAccount, type AnalysisType } from '@/lib/profile-analysis'

export const dynamic = 'force-dynamic'

const PLATFORMS = ['instagram', 'tiktok'] as const

/**
 * Profil analizi (mobil profil detayı, 10.3-S25). Web profil istatistik kartındaki kural tabanlı analizle aynı kod
 * (lib/profile-analysis.ts) ve aynı seviye kuralı (lib/subscription-tier.ts, sunucuda):
 *   - "Genel Özet" her seviyede açık;
 *   - "Kampanya ROI" yalnızca marka izleyiciye listelenir ve yalnızca Marka Pro'da (BRAND_PRO) içerik döner; diğerinde locked.
 * Profil erişim kuralı (oturum, marka onayı, keşif çarkı) getProfileForViewer ile uygulanır. İstatistik istemciden alınmaz;
 * profilin doğrulanmış hesabının kayıtlı istatistiğinden hesaplanır.
 * ?profileId=<uuid> → { tier, platforms: [{ platform, sections: [{ type, label, locked, items }] }] }
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const profileId = new URL(request.url).searchParams.get('profileId')
  const access = await getProfileForViewer(ctx.supabase, ctx.user.id, { id: profileId })
  if (access.status === 'not_found') return mobileJson({ error: 'Profil bulunamadı.' }, 404)
  if (access.status !== 'ok') return mobileJson({ error: 'Bu profili şu an görüntüleyemezsiniz.' }, 403)

  const tier = resolveSubscriptionTier(access.viewer)
  const viewerIsBrand = access.viewer.role === 'brand'
  const types: AnalysisType[] = viewerIsBrand ? ['basic', 'campaign_analysis'] : ['basic']

  const platforms = PLATFORMS.flatMap((platform) => {
    const account = access.socialAccounts
      .filter((a) => a.platform === platform && a.is_verified)
      .sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))[0]
    if (!account || !(account.follower_count && account.follower_count > 0)) return []
    const stats = statsFromSocialAccount(account)
    return [
      {
        platform,
        sections: types.map((type) => {
          const locked = !canRunAnalysis(tier, type)
          return {
            type,
            label: type === 'basic' ? 'Genel Özet' : 'Kampanya ROI',
            locked,
            items: locked ? [] : generateLocalAnalysis(stats, type),
          }
        }),
      },
    ]
  })

  return mobileJson({ tier, platforms })
}
