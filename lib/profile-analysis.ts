// Kural tabanlı profil analizi (yapay zekâ değil; istatistiklerden sabit kurallarla yorum üretir). Web sunucu aksiyonu
// (app/actions/ai-analysis.ts) ve mobil uç (/api/mobile/analysis, 10.3-S25) aynı kodu kullanır.
// Yorumlar yalnızca profilin kendi verisinden çıkar; kaynaksız sektör karşılaştırması, tahmini getiri veya garanti
// yazılmaz (4.3-S6). "Uyum skoru" ve "Profil koçu" modülleri çalışmadığı için kaldırıldı (2026-10-14).
//
// Bu dosya sunucu bağımlılığı içermez.

import type { SubscriptionTier } from '@/lib/subscription-tier'

export type AnalysisType = 'basic' | 'campaign_analysis'

/** Seviyeye göre açık analizler (seviye lib/subscription-tier.ts resolveSubscriptionTier ile sunucuda hesaplanır). */
export const TIER_PERMISSIONS: Record<SubscriptionTier, AnalysisType[]> = {
  FREE: ['basic'],
  SPOTLIGHT: ['basic'],
  SPOTLIGHT_PLUS: ['basic'],
  BRAND_PRO: ['basic', 'campaign_analysis'],
}

export const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  basic: 'Genel Özet',
  campaign_analysis: 'Kampanya ROI',
}

export function canRunAnalysis(tier: SubscriptionTier, type: AnalysisType) {
  return TIER_PERMISSIONS[tier].includes(type)
}

export function requiredTierName(type: AnalysisType): string {
  switch (type) {
    case 'campaign_analysis':
      return 'Spotlight Pro (marka)'
    default:
      return 'Free'
  }
}

export interface AnalysisStats {
  followerCount?: unknown
  followers?: unknown
  engagementRate?: unknown
  engagement?: unknown
  avg_likes?: unknown
  avg_comments?: unknown
  avg_views?: unknown
  posting_frequency?: unknown
}

/** Hesabın kayıtlı istatistiğinden analiz girdisi (web profil istatistik kartıyla aynı alanlar). */
export function statsFromSocialAccount(account: {
  follower_count: number | null
  engagement_rate: number | string | null
  stats_payload: Record<string, unknown> | null
}): AnalysisStats {
  const payload = account.stats_payload ?? {}
  return {
    followerCount: account.follower_count ?? 0,
    engagementRate: account.engagement_rate ?? 0,
    avg_likes: payload.avg_likes || payload.total_likes || 0,
    avg_comments: payload.avg_comments || 0,
    avg_views: payload.avg_views || 0,
    posting_frequency: payload.posting_frequency || 0,
  }
}

export function generateLocalAnalysis(stats: AnalysisStats, type: AnalysisType): string[] {
  const engagementRate = parseFloat(String(stats.engagementRate || stats.engagement || '0')) || 0
  const followers = parseMetric(stats.followerCount || stats.followers)
  const avgLikes = parseMetric(stats.avg_likes)
  const avgComments = parseMetric(stats.avg_comments)
  const avgViews = parseMetric(stats.avg_views)
  const postingFreq = Number(stats.posting_frequency) || 0 // Gönderiler arası gün

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
    if (conversationIndex > 5) comments.push('🗣️ Kanaat Önderi: Kitlesi içeriklerine yorumlarla güçlü tepki veriyor.')
    else if (viewRatio > 200) comments.push('🎬 İçerik Makinesi: İçerikleri takipçi sayısının üzerinde izleniyor.')
    else if (postingFreq > 0 && postingFreq <= 2) comments.push('🐝 Çalışkan Arı: Düzenli ve sık paylaşım yapıyor.')

    // KİTLE ANALİZİ (Audience)
    if (avgInteractions > 500000) comments.push('🏟️ Çok geniş etkileşimli kitle.')
    else if (avgInteractions > 50000) comments.push('🏙️ Geniş etkileşimli kitle.')
    else comments.push('☕ Butik Kafe: Az ama öz, birbirini tanıyan samimi bir topluluk.')

    // ÖLÇEK
    if (engagementRate > 6 && followers < 10000) comments.push('🌟 Küçük ama yüksek etkileşimli bir hesap.')
    else if (followers > 1000000) comments.push('👑 Milyonun üzerinde takipçiye sahip büyük bir hesap.')
    else comments.push('✅ Oturmuş bir profile sahip.')
  }

  // Kural sırasına göre ilk 3 yorum
  return comments.slice(0, 3)
}

// Yardımcılar
function parseMetric(val: unknown): number {
  if (typeof val === 'number') return val
  if (!val) return 0
  const str = String(val).toUpperCase().replace(/,/g, '.')
  if (str.includes('M')) return parseFloat(str) * 1000000
  if (str.includes('K') || str.includes('B')) return parseFloat(str) * 1000
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
