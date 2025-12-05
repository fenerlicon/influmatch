'use client'

import { Activity, TrendingUp, Users, MessageCircle, Heart, Zap } from 'lucide-react'

interface StatsPayload {
    avg_likes: number
    avg_comments: number
    avg_views: number
    following_count?: number
    post_count?: number
    is_verified?: boolean
    category_name?: string | null
    is_business_account?: boolean
    external_url?: string | null
    posting_frequency?: number
}

interface InfluencerStatsProps {
    followerCount: number
    engagementRate: number
    statsPayload: StatsPayload
    lastUpdated: string
    mode: 'brand-view' | 'influencer-view'
    hideAnalysisText?: boolean
}

export default function InfluencerStats({ followerCount, engagementRate, statsPayload, lastUpdated, mode, hideAnalysisText }: InfluencerStatsProps) {
    const safeStats = {
        avg_likes: statsPayload?.avg_likes || 0,
        avg_comments: statsPayload?.avg_comments || 0,
        avg_views: statsPayload?.avg_views || 0,
        following_count: statsPayload?.following_count || 0,
        post_count: statsPayload?.post_count || 0,
        is_verified: statsPayload?.is_verified || false,
        category_name: statsPayload?.category_name || null,
        is_business_account: statsPayload?.is_business_account || false,
        external_url: statsPayload?.external_url || null,
        posting_frequency: statsPayload?.posting_frequency || 0
    }

    // Rule-based AI Analysis Logic
    const generateAnalysis = () => {
        const analyses = []

        if (mode === 'brand-view') {
            // Brand Perspective: Why work with this influencer?
            if (engagementRate > 5) {
                analyses.push("Yüksek etkileşim oranıyla dikkat çekiyor.")
            } else if (engagementRate > 3) {
                analyses.push("Ortalamanın üzerinde bir etkileşim oranına sahip.")
            } else {
                analyses.push("Gelişmekte olan bir etkileşim grafiği var.")
            }

            if (followerCount > 100000) {
                analyses.push("Geniş kitlelere ulaşan Macro Influencer.")
            } else if (followerCount > 10000) {
                analyses.push("Niş kitlelere hitap eden Micro Influencer.")
            } else {
                analyses.push("Yüksek etkileşim potansiyeli olan Nano Influencer.")
            }

            if (safeStats.avg_comments > 0 && safeStats.avg_likes > 0) {
                const commentToLikeRatio = (safeStats.avg_comments / safeStats.avg_likes) * 100
                if (commentToLikeRatio > 5) {
                    analyses.push("Takipçileriyle güçlü bir iletişimi var.")
                }
            }

            if (safeStats.posting_frequency > 0 && safeStats.posting_frequency < 3) {
                analyses.push("Düzenli içerik paylaşımı yapıyor.")
            }
        } else {
            // Influencer Perspective: How to grow?
            if (engagementRate > 5) {
                analyses.push("Harika iş! Etkileşim oranlarınız çok iyi.")
            } else if (engagementRate > 3) {
                analyses.push("İyi gidiyorsunuz, etkileşimleriniz stabil.")
            } else {
                analyses.push("Etkileşimi artırmak için takipçilerinizle daha fazla iletişime geçin.")
            }

            if (followerCount < 10000) {
                analyses.push("Büyüme potansiyeliniz yüksek, düzenli paylaşıma devam edin.")
            }

            if (safeStats.avg_comments > 0 && safeStats.avg_likes > 0) {
                const commentToLikeRatio = (safeStats.avg_comments / safeStats.avg_likes) * 100
                if (commentToLikeRatio < 2) {
                    analyses.push("Yorumları teşvik edici içerikler paylaşmayı deneyin.")
                }
            }
        }

        return analyses
    }

    const analysisPoints = generateAnalysis()

    return (
        <div className="space-y-6">
            {/* Identity & Basic Info Row */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Instagram ID:</span>
                </div>

                {safeStats.is_verified && (
                    <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20">
                        <Zap className="h-3 w-3 fill-current" /> Onaylı Hesap
                    </span>
                )}

                {safeStats.category_name && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300 border border-white/10">
                        {safeStats.category_name}
                    </span>
                )}

                {safeStats.is_business_account && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/20">
                        İşletme Hesabı
                    </span>
                )}

                {safeStats.external_url && (
                    <a href={safeStats.external_url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs text-soft-gold hover:underline">
                        Website <TrendingUp className="h-3 w-3" />
                    </a>
                )}
            </div>

            {/* Detailed Stats Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {/* Row 1: Basic Info */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                        <Users className="h-4 w-4" />
                    </div>
                    <p className="text-xs uppercase tracking-wider text-gray-400">Takipçi</p>
                    <p className="mt-1 text-lg font-bold text-white">{followerCount.toLocaleString('tr-TR')}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                    <p className="text-xs uppercase tracking-wider text-gray-400">Etkileşim</p>
                    <p className="mt-1 text-lg font-bold text-white">%{engagementRate}</p>
                </div>

                {/* Row 2: Engagement Details */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                        <Heart className="h-4 w-4" />
                    </div>
                    <p className="text-xs uppercase tracking-wider text-gray-400">Ort. Beğeni</p>
                    <p className="mt-1 text-lg font-bold text-white">{safeStats.avg_likes.toLocaleString('tr-TR')}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                        <MessageCircle className="h-4 w-4" />
                    </div>
                    <p className="text-xs uppercase tracking-wider text-gray-400">Ort. Yorum</p>
                    <p className="mt-1 text-lg font-bold text-white">{safeStats.avg_comments.toLocaleString('tr-TR')}</p>
                </div>

                {safeStats.avg_views > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400">
                            <Activity className="h-4 w-4" />
                        </div>
                        <p className="text-xs uppercase tracking-wider text-gray-400">Ort. İzlenme</p>
                        <p className="mt-1 text-lg font-bold text-white">{safeStats.avg_views.toLocaleString('tr-TR')}</p>
                    </div>
                )}

                {safeStats.posting_frequency > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                            <Activity className="h-4 w-4" />
                        </div>
                        <p className="text-xs uppercase tracking-wider text-gray-400">Paylaşım Sıklığı</p>
                        <p className="mt-1 text-lg font-bold text-white">{safeStats.posting_frequency} günde bir</p>
                    </div>
                )}
            </div>

            {/* Data Info Footer */}
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span>Son 12 gönderi analiz edildi</span>
                </div>
                <div>
                    Son Güncelleme: <span className="text-gray-300 font-medium">{new Date(lastUpdated).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
            </div>

            {/* AI Analysis Section */}
            {!hideAnalysisText && (
                <div className="relative overflow-hidden rounded-3xl border border-soft-gold/20 bg-gradient-to-br from-[#1A1B22] to-[#0F1014] p-6 shadow-glow">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-soft-gold/5 blur-3xl"></div>

                    <div className="relative flex items-start gap-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-soft-gold to-yellow-600 text-black shadow-lg">
                            <Zap className="h-5 w-5 fill-current" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white">
                                    {mode === 'brand-view' ? 'Yapay Zeka Analizi' : 'Performans Analizi'}
                                </h3>
                                <span className="rounded-full bg-soft-gold/10 px-2 py-0.5 text-[10px] font-medium text-soft-gold border border-soft-gold/20">BETA</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-400">
                                {mode === 'brand-view'
                                    ? 'Bu influencer hakkında yapay zeka destekli içgörüler:'
                                    : 'Profilinizi geliştirmek için öneriler:'}
                            </p>

                            <div className="mt-4 space-y-3">
                                {analysisPoints.map((point, index) => (
                                    <div key={index} className="flex gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition hover:bg-white/10">
                                        <TrendingUp className="h-5 w-5 flex-shrink-0 text-soft-gold" />
                                        <p className="text-sm text-gray-200">{point}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
