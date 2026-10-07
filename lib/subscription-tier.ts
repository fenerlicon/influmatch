// Analiz özelliklerinin seviyesi (FREE / SPOTLIGHT / SPOTLIGHT_PLUS / BRAND_PRO) tek yerden hesaplanır.
// Önceden sunucu aksiyonu, dashboard ve profil sayfası farklı kurallar kullanıyordu (süre / onay kontrolü,
// Pro planın tanınması). Markalar şimdilik plandan bağımsız BRAND_PRO alır (ürün kararı, SYSTEM_MAP 3.13).

import { hasActiveSpotlight, type SpotlightFields } from '@/lib/spotlight-access'

export type SubscriptionTier = 'FREE' | 'SPOTLIGHT' | 'SPOTLIGHT_PLUS' | 'BRAND_PRO'

/** Geçerli plan kodları: ibasic / ipro (influencer), mbasic / mpro (marka). */
export function isProPlan(plan: string | null | undefined): boolean {
  return plan === 'ipro' || plan === 'mpro'
}

export interface TierFields extends SpotlightFields {
  role?: string | null
  spotlight_plan?: string | null
  verification_status?: string | null
}

export function resolveSubscriptionTier(user: TierFields | null | undefined): SubscriptionTier {
  if (!user) return 'FREE'
  if (user.role === 'brand') return 'BRAND_PRO'
  if (user.verification_status !== 'verified' || !hasActiveSpotlight(user)) return 'FREE'
  return isProPlan(user.spotlight_plan) ? 'SPOTLIGHT_PLUS' : 'SPOTLIGHT'
}
