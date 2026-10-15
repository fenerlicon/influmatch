'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { resolveSubscriptionTier, type SubscriptionTier } from '@/lib/subscription-tier'
import { canRunAnalysis, generateLocalAnalysis, requiredTierName, type AnalysisStats, type AnalysisType } from '@/lib/profile-analysis'

// Define the response structure
export interface AIAnalysisResponse {
    analysis: string[]
    error?: string
}

export type { AnalysisType } from '@/lib/profile-analysis'

export type { SubscriptionTier } from '@/lib/subscription-tier'

/** Kural tabanlı profil analizi (lib/profile-analysis.ts; mobil /api/mobile/analysis aynı kodu kullanır). */
export async function generateAIAnalysis(
    stats: AnalysisStats,
    _mode: 'brand-view' | 'influencer-view',
    requestedType: AnalysisType = 'basic'
): Promise<AIAnalysisResponse> {
    const supabase = createSupabaseServerClient()

    // 0. GÜVENLİK: Kullanıcının gerçek üyelik seviyesini (Tier) veritabanından çek.
    // Client'tan (tarayıcıdan) gelen "ben proyum" beyanına güvenme!
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return { analysis: [], error: 'Oturum açmanız gerekiyor.' }

    const { data: dbUser } = await supabase
        .from('users')
        .select('spotlight_active, spotlight_plan, spotlight_expires_at, role, verification_status')
        .eq('id', authUser.id)
        .single()

    // Seviye tek yerden: süresi dolmuş veya onaysız Spotlight seviye vermez (lib/subscription-tier.ts).
    const userTier: SubscriptionTier = resolveSubscriptionTier(dbUser)

    // 1. Check Permissions
    if (!canRunAnalysis(userTier, requestedType)) {
        return {
            analysis: [],
            error: `Bu özelliği kullanmak için paketiniz yetersiz. (Gerekli: ${requiredTierName(requestedType)})`
        }
    }

    // 2. Local Intelligence Logic (Free & Fast)
    try {
        return { analysis: generateLocalAnalysis(stats, requestedType) }
    } catch (err: unknown) {
        console.error('Local Analysis Error:', err)
        return {
            analysis: [],
            error: 'Analiz oluşturulurken bir hata oluştu.'
        }
    }
}
