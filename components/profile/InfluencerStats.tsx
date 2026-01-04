'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, TrendingUp, Users, MessageCircle, Heart, Zap, Lock, Sparkles, AlertCircle } from 'lucide-react'
import { generateAIAnalysis, type AnalysisType, type SubscriptionTier } from '@/app/actions/ai-analysis'
import { toast } from 'sonner'

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
    subscriptionTier?: SubscriptionTier
    viewerRole?: 'brand' | 'influencer' | 'admin'
}

export default function InfluencerStats({
    followerCount,
    engagementRate,
    statsPayload,
    lastUpdated,
    mode,
    hideAnalysisText,
    subscriptionTier = 'FREE',
    viewerRole
}: InfluencerStatsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [aiAnalysis, setAiAnalysis] = useState<string[]>([])
    const [lastAnalysisType, setLastAnalysisType] = useState<AnalysisType>('basic')
    const [showPaywall, setShowPaywall] = useState<AnalysisType | null>(null)

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

    // Rule-based Analysis (Fallback)
    const generateStaticAnalysis = () => {
        const analyses = []
        if (mode === 'brand-view') {
            if (engagementRate > 5) analyses.push("Yüksek etkileşim oranıyla dikkat çekiyor.")
            else if (engagementRate > 3) analyses.push("Ortalamanın üzerinde bir etkileşim oranına sahip.")
            else analyses.push("Gelişmekte olan bir etkileşim grafiği var.")

            if (followerCount > 100000) analyses.push("Geniş kitlelere ulaşan Macro Influencer.")
            else if (followerCount > 10000) analyses.push("Niş kitlelere hitap eden Micro Influencer.")
            else analyses.push("Yüksek etkileşim potansiyeli olan Nano Influencer.")

            if (safeStats.avg_comments > 0 && safeStats.avg_likes > 0) {
                if ((safeStats.avg_comments / safeStats.avg_likes) * 100 > 5) analyses.push("Takipçileriyle güçlü bir iletişimi var.")
            }
        } else {
            if (engagementRate > 5) analyses.push("Harika iş! Etkileşim oranlarınız çok iyi.")
            else if (engagementRate > 3) analyses.push("İyi gidiyorsunuz, etkileşimleriniz stabil.")

            if (followerCount < 10000) analyses.push("Büyüme potansiyeliniz yüksek, düzenli paylaşıma devam edin.")
        }
        return analyses
    }

    const [currentAnalysis, setCurrentAnalysis] = useState<string[]>(generateStaticAnalysis())

    const handleRunAnalysis = (type: AnalysisType) => {
        // Tier Check (Simple client-side pre-check)
        const requiredTier = {
            'basic': 'FREE',
            'match_score': 'SPOTLIGHT',
            'profile_coach': 'SPOTLIGHT_PLUS',
            'campaign_analysis': 'BRAND_PRO'
        }[type] as SubscriptionTier

        const permissionOrder: SubscriptionTier[] = ['FREE', 'SPOTLIGHT', 'SPOTLIGHT_PLUS', 'BRAND_PRO']

        // Very basic hierarchy check
        const userLevel = permissionOrder.indexOf(subscriptionTier)
        const reqLevel = permissionOrder.indexOf(requiredTier)

        if (userLevel < reqLevel) {
            setShowPaywall(type)
            return
        }

        startTransition(async () => {
            const result = await generateAIAnalysis(
                { ...safeStats, followerCount, engagementRate },
                mode,
                subscriptionTier,
                type
            )

            if (result.error) {
                toast.error(result.error)
            } else if (result.analysis) {
                setAiAnalysis(result.analysis)
                setCurrentAnalysis(result.analysis)
                setLastAnalysisType(type)
                toast.success('Yapay zeka analizi tamamlandı!')
            }
        })
    }

    const AnalysisButton = ({ type, label, icon: Icon, requiredTier }: { type: AnalysisType, label: string, icon: any, requiredTier: SubscriptionTier }) => {
        const permissionOrder: SubscriptionTier[] = ['FREE', 'SPOTLIGHT', 'SPOTLIGHT_PLUS', 'BRAND_PRO']
        const isLocked = permissionOrder.indexOf(subscriptionTier) < permissionOrder.indexOf(requiredTier)

        return (
            <button
                onClick={() => handleRunAnalysis(type)}
                disabled={isPending}
                className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all
                    ${lastAnalysisType === type && !isLocked && !isPending
                        ? 'border-soft-gold/30 bg-soft-gold/10 text-soft-gold shadow-glow-sm'
                        : 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'}
                `}
            >
                {isLocked ? <Lock className="h-3 w-3 text-gray-500" /> : <Icon className="h-3 w-3" />}
                <span>{label}</span>
                {isLocked && <span className="ml-1 text-[9px] uppercase tracking-wider opacity-50">{requiredTier}</span>}
                {isPending && lastAnalysisType === type && <Sparkles className="h-3 w-3 animate-pulse text-soft-gold" />}
            </button>
        )
    }

    const handleUpgrade = () => {
        // Determine target path based on viewer role or mode
        const isBrand = viewerRole === 'brand' || mode === 'brand-view'
        const targetPath = isBrand ? '/dashboard/spotlight/brand' : '/dashboard/spotlight/influencer'
        router.push(targetPath)
    }

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
                <div className="group relative overflow-hidden rounded-3xl border border-soft-gold/20 bg-gradient-to-br from-[#1A1B22] to-[#0F1014] p-6 shadow-glow transition-all hover:border-soft-gold/40">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-soft-gold/5 blur-3xl transition-all group-hover:bg-soft-gold/10"></div>

                    {/* AI Feature Selector */}
                    <div className="mb-6 flex flex-wrap gap-2">
                        <AnalysisButton type="basic" label="Genel Özet" icon={Sparkles} requiredTier="FREE" />
                        <AnalysisButton type="match_score" label="AI Uyum Skoru" icon={Activity} requiredTier="SPOTLIGHT" />

                        {mode === 'influencer-view' && (
                            <AnalysisButton type="profile_coach" label="AI Koç" icon={Zap} requiredTier="SPOTLIGHT_PLUS" />
                        )}

                        {/* Only show Campaign ROI if explicitly viewing as BRAND */}
                        {mode === 'brand-view' && viewerRole === 'brand' && (
                            <AnalysisButton type="campaign_analysis" label="Kampanya ROI" icon={TrendingUp} requiredTier="BRAND_PRO" />
                        )}
                    </div>

                    <div className="relative flex items-start gap-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-soft-gold to-yellow-600 text-black shadow-lg">
                            {isPending ? <Sparkles className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-current" />}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white">
                                    {isPending ? 'Yapay Zeka Düşünüyor...' : 'Detaylı Profil Analizi'}
                                </h3>
                                <span className="rounded-full bg-soft-gold/10 px-2 py-0.5 text-[10px] font-medium text-soft-gold border border-soft-gold/20">BETA</span>
                            </div>

                            {/* Loading State or Content */}
                            {isPending ? (
                                <div className="mt-4 space-y-2">
                                    <div className="h-4 w-3/4 animate-pulse rounded bg-white/10"></div>
                                    <div className="h-4 w-1/2 animate-pulse rounded bg-white/10"></div>
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/10"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="mt-4 space-y-3">
                                        {currentAnalysis.map((point, index) => (
                                            <div key={index} className="flex gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition hover:bg-white/10">
                                                <TrendingUp className="h-5 w-5 flex-shrink-0 text-soft-gold" />
                                                <p className="text-sm text-gray-200">{point}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer Info or Disclaimer */}
                                    <p className="mt-4 text-[10px] text-gray-500">
                                        * Bu analiz Gemini AI tarafından oluşturulmuştur. Finansal veya kesin yatırım tavsiyesi değildir.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Paywall Overlay */}
                    {showPaywall && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center">
                            <Lock className="h-12 w-12 text-soft-gold mb-4" />
                            <h3 className="text-xl font-bold text-white">Bu Özelliği Aç</h3>
                            <p className="mb-6 mt-2 text-sm text-gray-400 max-w-sm">
                                {showPaywall === 'match_score' ? 'Detaylı uyum skorlarını görmek için Spotlight paketine geçin.' :
                                    showPaywall === 'profile_coach' ? 'Kişisel AI koçunuzu aktifleştirmek için Spotlight+ paketine geçin.' :
                                        'Kampanya ve ROI analizleri için Brand Pro paketi gereklidir.'}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowPaywall(null)}
                                    className="rounded-xl border border-white/10 bg-white/5 px-6 py-2 text-sm text-white hover:bg-white/10"
                                >
                                    Vazgeç
                                </button>
                                <button
                                    onClick={handleUpgrade}
                                    className="rounded-xl bg-soft-gold px-6 py-2 text-sm font-bold text-black hover:bg-yellow-500"
                                >
                                    Paket Yükselt
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
