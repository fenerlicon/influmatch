// Analiz özelliklerinin seviyesi (FREE / SPOTLIGHT / SPOTLIGHT_PLUS / BRAND_PRO) tek yerden hesaplanır.
// Önceden sunucu aksiyonu, dashboard ve profil sayfası farklı kurallar kullanıyordu (süre / onay kontrolü,
// Pro planın tanınması). Markalar da gerçek planlarına göre (2026-10-14 kararı): onaylı + aktif Spotlight değilse FREE,
// mbasic → SPOTLIGHT, mpro → BRAND_PRO (influencer'da ibasic → SPOTLIGHT, ipro → SPOTLIGHT_PLUS ile aynı düzen).
// Önceden her marka plandan bağımsız BRAND_PRO alıyordu; "Kampanya ROI" analizi artık yalnızca Pro markada açık.

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
  if (user.role !== 'brand' && user.role !== 'influencer') return 'FREE'
  if (user.verification_status !== 'verified' || !hasActiveSpotlight(user)) return 'FREE'
  const pro = isProPlan(user.spotlight_plan)
  if (user.role === 'brand') return pro ? 'BRAND_PRO' : 'SPOTLIGHT'
  return pro ? 'SPOTLIGHT_PLUS' : 'SPOTLIGHT'
}
