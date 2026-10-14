'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { resolveSubscriptionTier, type SubscriptionTier } from '@/lib/subscription-tier'

// Define the response structure
export interface AIAnalysisResponse {
    analysis: string[]
    error?: string
}

export type AnalysisType = 'basic' | 'campaign_analysis'

export type { SubscriptionTier } from '@/lib/subscription-tier'

// Tier Permissions Configuration
const TIER_PERMISSIONS: Record<SubscriptionTier, AnalysisType[]> = {
    FREE: ['basic'],
    SPOTLIGHT: ['basic'],
    SPOTLIGHT_PLUS: ['basic'],
    BRAND_PRO: ['basic', 'campaign_analysis']
}

export async function generateAIAnalysis(
    stats: any,
    mode: 'brand-view' | 'influencer-view',
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
    if (!TIER_PERMISSIONS[userTier].includes(requestedType)) {
        return {
            analysis: [],
            error: `Bu özelliği kullanmak için paketiniz yetersiz. (Gerekli: ${getRequiredTierName(requestedType)})`
        }
    }

    // 2. Local Intelligence Logic (Free & Fast)
    try {
        const analysis = generateLocalAnalysis(stats, mode, requestedType)

        return { analysis }

    } catch (err: any) {
        console.error('Local Analysis Error:', err)
        return {
            analysis: [],
            error: 'Analiz oluşturulurken bir hata oluştu.'
        }
    }
}

// --- Kural tabanlı profil analizi (yapay zekâ değil; istatistiklerden sabit kurallarla yorum üretir) ---
// Yorumlar yalnızca profilin kendi verisinden çıkar; kaynaksız sektör karşılaştırması, tahmini getiri veya garanti
// yazılmaz (4.3-S6). "Uyum skoru" ve "Profil koçu" modülleri çalışmadığı için kaldırıldı (2026-10-14).

function generateLocalAnalysis(stats: any, _mode: 'brand-view' | 'influencer-view', type: AnalysisType): string[] {
    const engagementRate = parseFloat(stats.engagementRate || stats.engagement || '0')
    const followers = parseMetric(stats.followerCount || stats.followers)
    const avgLikes = parseMetric(stats.avg_likes)
    const avgComments = parseMetric(stats.avg_comments)
    const avgViews = parseMetric(stats.avg_views)
    const postingFreq = stats.posting_frequency || 0 // Gönderiler arası gün

    // Yorum / beğeni oranı (%): kitlenin ne kadar yorum yaptığı.
    const conversationIndex = avgLikes > 0 ? (avgComments / avgLikes) * 100 : 0
    // İzlenme / takipçi oranı (%).
    const viewRatio = followers > 0 ? (avgViews / followers) * 100 : 0
    // Gönderi başına ortalama etkileşim (takipçi × etkileşim oranı).
    const avgInteractions = followers * (engagementRate / 100)

    const comments: string[] = []

    // KAMPANYA ROI (marka, Pro): profilin kendi ölçümleri; getiri tahmini yok.
    if (type === 'campaign_analysis') {
        if (avgInteractions > 0) {
            comments.push(`👥 Etkileşim hacmi: gönderi başına ortalama yaklaşık ${formatNumber(Math.round(avgInteractions))} etkileşim (takipçi × etkileşim oranı).`)
        }
        if (avgViews > 0 && followers > 0) {
            comments.push(`📺 İzlenme oranı: ortalama izlenme, takipçi sayısının yaklaşık %${Math.round(viewRatio)} kadarı.`)
        }
        if (engagementRate > 5) {
            comments.push(`🔥 Etkileşim oranı %${engagementRate.toFixed(1)}: kitle içeriklere aktif tepki veriyor; dönüşüm odaklı kampanyalarda değerlendirilebilir.`)
        } else if (engagementRate > 0) {
            comments.push(`📊 Etkileşim oranı %${engagementRate.toFixed(1)}: kampanya hedefini (bilinirlik / dönüşüm) bu oranla birlikte değerlendirin.`)
        }
        if (comments.length === 0) comments.push('Bu profil için kampanya analizi yapacak yeterli veri yok.')
    }

    // GENEL ÖZET
    else {
        // KİŞİLİK ANALİZİ (Persona)
        if (conversationIndex > 5) comments.push("🗣️ Kanaat Önderi: Kitlesi içeriklerine yorumlarla güçlü tepki veriyor.")
        else if (viewRatio > 200) comments.push("🎬 İçerik Makinesi: İçerikleri takipçi sayısının üzerinde izleniyor.")
        else if (postingFreq > 0 && postingFreq <= 2) comments.push("🐝 Çalışkan Arı: Düzenli ve sık paylaşım yapıyor.")

        // KİTLE ANALİZİ (Audience)
        if (avgInteractions > 500000) comments.push("🏟️ Çok geniş etkileşimli kitle.")
        else if (avgInteractions > 50000) comments.push("🏙️ Geniş etkileşimli kitle.")
        else comments.push("☕ Butik Kafe: Az ama öz, birbirini tanıyan samimi bir topluluk.")

        // ÖLÇEK
        if (engagementRate > 6 && followers < 10000) comments.push("🌟 Küçük ama yüksek etkileşimli bir hesap.")
        else if (followers > 1000000) comments.push("👑 Milyonun üzerinde takipçiye sahip büyük bir hesap.")
        else comments.push("✅ Oturmuş bir profile sahip.")
    }

    // Kural sırasına göre ilk 3 yorum
    return comments.slice(0, 3)
}

function getRequiredTierName(type: AnalysisType): string {
    switch (type) {
        case 'campaign_analysis': return 'Spotlight Pro (marka)'
        default: return 'Free'
    }
}

// Helpers
function parseMetric(val: any): number {
    if (typeof val === 'number') return val
    if (!val) return 0
    let str = val.toString().toUpperCase().replace(/,/g, '.')
    if (str.includes('M')) return parseFloat(str) * 1000000
    if (str.includes('K') || str.includes('B')) return parseFloat(str) * 1000
    return parseFloat(str.replace(/[^0-9.]/g, '')) || 0
}

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
}
