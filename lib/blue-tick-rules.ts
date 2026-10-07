// Mavi tik (verified-account rozeti) kuralı. İstemci ve sunucu ortak kullanır.
//
// Hesap sahipliği artık kayıtta herkes için zorunlu olduğundan mavi tik bir seçkinlik
// göstergesidir ve bilerek zor tutulur: aktif Spotlight üyeliği + performans + güven.
// Eşikler sadece buradan değiştirilir; saatlik görev, istatistik yenileme ve
// panel aynı kuralı kullanır.

import { calculateTrustScore } from '@/utils/matching'

export const BLUE_TICK_BADGE_ID = 'verified-account'

export const BLUE_TICK_RULES = {
  /** utils/matching.ts calculateTrustScore ölçeğinde (0-100); 80 ve üzeri "Mükemmel". */
  minTrustScore: 80,
  /** Doğrulanmış Instagram veya TikTok hesabındaki takipçi sayısı. */
  minFollowers: 10_000,
  /** İstatistiklerin en fazla bu kadar gün eski olmasına izin verilir. */
  maxStatsAgeDays: 30,
}

export interface BlueTickProfile {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  category: string | null
  spotlight_active: boolean | null
  spotlight_expires_at: string | null
}

export interface BlueTickAccount {
  platform: string
  is_verified: boolean | null
  has_stats: boolean | null
  follower_count: number | null
  engagement_rate: number | string | null
  stats_payload: Record<string, any> | null
  last_scraped_at: string | null
}

export interface BlueTickCriterion {
  key: 'spotlight' | 'account' | 'fresh' | 'followers' | 'trust'
  label: string
  met: boolean
  detail: string
}

export interface BlueTickEvaluation {
  eligible: boolean
  trustScore: number
  criteria: BlueTickCriterion[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const formatNumber = (value: number) => value.toLocaleString('tr-TR')

export function isSpotlightCurrentlyActive(profile: Pick<BlueTickProfile, 'spotlight_active' | 'spotlight_expires_at'>, now = Date.now()) {
  if (!profile.spotlight_active) return false
  return !profile.spotlight_expires_at || new Date(profile.spotlight_expires_at).getTime() > now
}

/** Doğrulanmış ve istatistiği olan hesaplar arasından en çok takipçili olan. */
function pickPrimaryAccount(accounts: BlueTickAccount[]) {
  return (
    accounts
      .filter((account) => account.is_verified && account.has_stats)
      .sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))[0] ?? null
  )
}

export function evaluateBlueTick(profile: BlueTickProfile, accounts: BlueTickAccount[], now = Date.now()): BlueTickEvaluation {
  const spotlight = isSpotlightCurrentlyActive(profile, now)
  const primary = pickPrimaryAccount(accounts)
  const followers = primary?.follower_count ?? 0
  const statsAgeDays = primary?.last_scraped_at ? (now - new Date(primary.last_scraped_at).getTime()) / DAY_MS : Infinity

  const trustScore = calculateTrustScore({
    id: profile.id,
    full_name: profile.full_name,
    username: profile.username,
    category: profile.category,
    avatar_url: profile.avatar_url,
    spotlight_active: spotlight,
    stats: primary
      ? {
          followers: String(followers),
          engagement: `${Number(primary.engagement_rate) || 0}%`,
          avg_comments: String(primary.stats_payload?.avg_comments ?? 0),
        }
      : undefined,
  })

  const criteria: BlueTickCriterion[] = [
    {
      key: 'spotlight',
      label: 'Aktif Spotlight üyeliği',
      met: spotlight,
      detail: spotlight ? 'Aktif' : 'Spotlight üyeliği gerekli',
    },
    {
      key: 'account',
      label: 'Doğrulanmış Instagram veya TikTok hesabı',
      met: !!primary,
      detail: primary ? `${primary.platform === 'tiktok' ? 'TikTok' : 'Instagram'} doğrulandı` : 'İstatistikleri alınmış doğrulanmış hesap yok',
    },
    {
      key: 'fresh',
      label: `Son ${BLUE_TICK_RULES.maxStatsAgeDays} günde güncellenmiş istatistikler`,
      met: statsAgeDays <= BLUE_TICK_RULES.maxStatsAgeDays,
      detail: Number.isFinite(statsAgeDays) ? `${Math.floor(statsAgeDays)} gün önce güncellendi` : 'Güncelleme yok',
    },
    {
      key: 'followers',
      label: `En az ${formatNumber(BLUE_TICK_RULES.minFollowers)} takipçi`,
      met: followers >= BLUE_TICK_RULES.minFollowers,
      detail: `${formatNumber(followers)} takipçi`,
    },
    {
      key: 'trust',
      label: `Güven skoru en az ${BLUE_TICK_RULES.minTrustScore}`,
      met: trustScore >= BLUE_TICK_RULES.minTrustScore,
      detail: `Güven skoru: ${trustScore}`,
    },
  ]

  return { eligible: criteria.every((criterion) => criterion.met), trustScore, criteria }
}
