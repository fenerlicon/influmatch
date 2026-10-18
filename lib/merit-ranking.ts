// Liyakatli listeleme (0₺ dönemi, 2026-10-16 kararı; SYSTEM_MAP 3.21-N1). 0₺ döneminde herkes Spotlight'ta olduğu için keşifte
// "Spotlight önde" kuralı anlamını yitirir; bayrak (promo_period_enabled) açıkken sıralama liyakat puanına göre yapılır.
// Puan: güven skoru (Spotlight puanı hariç, utils/matching.ts) + tamamlanan iş birliği başına 5 puan (en fazla 10 iş = 50 puan).
// "Şu an dolu" profiller yine sonda (lib/discover-filters.ts). Sunucu ve istemci ortak (sunucuya özel içe aktarım yok).

import { calculateTrustScore } from '@/utils/matching'

export const MERIT_COLLAB_POINTS = 5
export const MERIT_COLLAB_CAP = 10

export interface MeritAccount {
  follower_count: number | null
  engagement_rate: number | string | null
  stats_payload?: Record<string, unknown> | null
}

export interface MeritProfile {
  id: string
  full_name: string | null
  username: string | null
  category: string | null
  avatar_url: string | null
}

/** Güven skoru, Spotlight puanı olmadan; en çok takipçili hesabın istatistiğiyle. */
export function meritTrust(profile: MeritProfile, accounts: MeritAccount[]): number {
  const primary = [...accounts].sort((a, b) => (Number(b.follower_count) || 0) - (Number(a.follower_count) || 0))[0]
  return calculateTrustScore({
    ...profile,
    spotlight_active: false,
    stats: primary
      ? {
          followers: String(Number(primary.follower_count) || 0),
          engagement: `${Number(primary.engagement_rate) || 0}%`,
          avg_comments: String((primary.stats_payload as Record<string, unknown> | null | undefined)?.avg_comments ?? 0),
        }
      : undefined,
  })
}

export function meritScore(trust: number, completedCollabs: number): number {
  return trust + Math.min(Math.max(0, completedCollabs), MERIT_COLLAB_CAP) * MERIT_COLLAB_POINTS
}
