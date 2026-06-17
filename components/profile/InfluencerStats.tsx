'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Activity, 
  TrendingUp, 
  Users, 
  MessageCircle, 
  Heart, 
  Zap, 
  Lock, 
  Sparkles, 
  AlertCircle, 
  ArrowUp, 
  ArrowDown, 
  Calendar,
  Instagram
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

const formatDist = (dateStr: string) => {
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: tr })
    } catch (e) {
        return 'yakın zamanda'
    }
}

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
    changes?: {
        engagement_rate: number
        follower_count: number
        avg_likes: number
        avg_views: number
        updated_at: string
    }
}

export interface PlatformData {
    username?: string | null
    followerCount: number
    engagementRate?: number
    statsPayload: any
    lastUpdated: string
}

interface InfluencerStatsProps {
    instagramData?: PlatformData
    tiktokData?: PlatformData
    
    // Backwards compatibility props
    followerCount?: number
    engagementRate?: number
    statsPayload?: StatsPayload
    lastUpdated?: string
    
    mode: 'brand-view' | 'influencer-view'
    hideAnalysisText?: boolean
    subscriptionTier?: SubscriptionTier
    viewerRole?: 'brand' | 'influencer' | 'admin'
}

export default function InfluencerStats({
    instagramData,
    tiktokData,
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

    // Normalize input data
    const fallbackInstagram: PlatformData | undefined = followerCount !== undefined ? {
        followerCount,
        engagementRate,
        statsPayload: statsPayload as StatsPayload,
        lastUpdated: lastUpdated || new Date().toISOString()
    } : undefined

    const finalInstagram = instagramData || fallbackInstagram
    const hasInstagram = !!finalInstagram && finalInstagram.followerCount > 0
    const hasTikTok = !!tiktokData

    // Default to whichever is available, preferring Instagram if both are present
    const [activePlatform, setActivePlatform] = useState<'instagram' | 'tiktok'>(
        hasInstagram ? 'instagram' : 'tiktok'
    )

    // Get active data
    const activeData = activePlatform === 'tiktok' ? tiktokData : finalInstagram
    const isTikTok = activePlatform === 'tiktok'

    const safeStats = {
        avg_likes: activeData?.statsPayload?.avg_likes || activeData?.statsPayload?.total_likes || 0,
        avg_comments: activeData?.statsPayload?.avg_comments || 0,
        avg_views: activeData?.statsPayload?.avg_views || 0,
        following_count: activeData?.statsPayload?.following_count || 0,
        post_count: activeData?.statsPayload?.post_count || activeData?.statsPayload?.video_count || activeData?.statsPayload?.media_count || 0,
        is_verified: activeData?.statsPayload?.is_verified || false,
        category_name: activeData?.statsPayload?.category_name || null,
        is_business_account: activeData?.statsPayload?.is_business_account || false,
        external_url: activeData?.statsPayload?.external_url || null,
        posting_frequency: activeData?.statsPayload?.posting_frequency || 0
    }

    // Rule-based Analysis (Fallback)
    const generateStaticAnalysis = () => {
        const analyses = []
        const fCount = activeData?.followerCount || 0
        const eRate = activeData?.engagementRate || (isTikTok ? 4.8 : 3.0)

        if (isTikTok) {
            if (eRate > 6) analyses.push("TikTok üzerinde dikkat çekici derecede yüksek etkileşime sahip.")
            else if (eRate > 4) analyses.push("Ortalamanın üzerinde TikTok etkileşim oranıyla öne çıkıyor.")
            else analyses.push("TikTok algoritmasında stabil ve düzenli bir izleyici etkileşimi var.")

            if (fCount > 100000) analyses.push("Geniş kitlelere ulaşan popüler TikTok içerik üreticisi.")
            else if (fCount > 10000) analyses.push("Niş kitlelere hitap eden, büyümekte olan TikTok hesabı.")
            else analyses.push("Yüksek büyüme potansiyeline sahip mikro TikTok üreticisi.")

            if (safeStats.avg_likes > 50000) {
                analyses.push("Gönderileri yüksek beğeni topluyor ve viral potansiyeli yüksek.")
            }
        } else {
            if (eRate > 5) analyses.push("Yüksek etkileşim oranıyla dikkat çekiyor.")
            else if (eRate > 3) analyses.push("Ortalamanın üzerinde bir etkileşim oranına sahip.")
            else analyses.push("Gelişmekte olan bir etkileşim grafiği var.")

            if (fCount > 100000) analyses.push("Geniş kitlelere ulaşan Macro Influencer.")
            else if (fCount > 10000) analyses.push("Niş kitlelere hitap eden Micro Influencer.")
            else analyses.push("Yüksek etkileşim potansiyeli olan Nano Influencer.")

            if (safeStats.avg_comments > 0 && safeStats.avg_likes > 0) {
                if ((safeStats.avg_comments / safeStats.avg_likes) * 100 > 5) analyses.push("Takipçileriyle güçlü bir iletişimi var.")
            }
        }
        return analyses
    }

    const [currentAnalysis, setCurrentAnalysis] = useState<string[]>([])

    // Update currentAnalysis when active platform changes
    useEffect(() => {
        setAiAnalysis([])
        setLastAnalysisType('basic')
        setCurrentAnalysis(generateStaticAnalysis())
    }, [activePlatform, activeData])

    const handleRunAnalysis = (type: AnalysisType) => {
        if (type === 'match_score' || type === 'profile_coach') {
            toast('Çok yakın zamanda!')
            return
        }

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
                { 
                    avg_likes: safeStats.avg_likes,
                    avg_comments: safeStats.avg_comments,
                    avg_views: safeStats.avg_views,
                    followerCount: activeData?.followerCount || 0, 
                    engagementRate: activeData?.engagementRate || 0 
                },
                mode,
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
        const isActive = lastAnalysisType === type && !isLocked && !isPending

        let activeClasses = 'border-soft-gold/30 bg-soft-gold/10 text-soft-gold shadow-glow-sm'
        if (isTikTok) {
            activeClasses = 'border-[#25F4EE]/40 bg-[#25F4EE]/10 text-[#25F4EE] shadow-[0_0_15px_rgba(37,244,238,0.15)]'
        }

        return (
            <button
                onClick={() => handleRunAnalysis(type)}
                disabled={isPending}
                className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all
                    ${isActive
                        ? activeClasses
                        : 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'}
                `}
            >
                {isLocked ? <Lock className="h-3 w-3 text-gray-500" /> : <Icon className="h-3 w-3" />}
                <span>{label}</span>
                {isLocked && <span className="ml-1 text-[9px] uppercase tracking-wider opacity-50">{requiredTier}</span>}
                {isPending && lastAnalysisType === type && (
                    <Sparkles className={`h-3 w-3 animate-pulse ${isTikTok ? 'text-[#25F4EE]' : 'text-soft-gold'}`} />
                )}
            </button>
        )
    }

    const handleUpgrade = () => {
        const isBrand = viewerRole === 'brand' || mode === 'brand-view'
        const targetPath = isBrand ? '/dashboard/spotlight/brand' : '/dashboard/spotlight/influencer'
        router.push(targetPath)
    }

    const renderChange = (value?: number, isPercent: boolean = false) => {
        if (!value || value === 0) return null
        const isPositive = value > 0
        return (
            <div className={`mt-1 flex items-center justify-center gap-0.5 text-[10px] font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span>{isPositive ? '+' : ''}{value.toLocaleString('tr-TR')}{isPercent ? '%' : ''}</span>
            </div>
        )
    }

    if (!activeData) return null

    return (
        <div className={`space-y-6 transition-all duration-500 rounded-3xl ${
            isTikTok 
            ? 'shadow-[0_0_50px_rgba(37,244,238,0.06)] border border-[#25F4EE]/10 bg-black/20 p-5' 
            : ''
        }`}>
            {/* Platform Selector Tabs */}
            {hasInstagram && hasTikTok && (
                <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
                    <button
                        onClick={() => setActivePlatform('instagram')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                            activePlatform === 'instagram'
                                ? 'bg-gradient-to-r from-yellow-500/10 to-red-500/10 border border-red-500/20 text-white shadow-glow-sm'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Instagram className="h-4 w-4" />
                        Instagram
                    </button>
                    <button
                        onClick={() => setActivePlatform('tiktok')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                            activePlatform === 'tiktok'
                                ? 'bg-gradient-to-r from-[#25F4EE]/10 to-[#FE2C55]/10 border border-[#FE2C55]/20 text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
                        </svg>
                        TikTok
                    </button>
                </div>
            )}

            {/* Identity & Basic Info Row */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-xs uppercase tracking-wider text-gray-500">
                        {isTikTok ? 'TikTok ID:' : 'Instagram ID:'}
                    </span>
                    <span className="font-semibold">
                        @{activeData.username || 'bağlı-hesap'}
                    </span>
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
                    <a href={safeStats.external_url} target="_blank" rel="noopener noreferrer" className={`ml-auto flex items-center gap-1 text-xs hover:underline ${isTikTok ? 'text-[#25F4EE]' : 'text-soft-gold'}`}>
                        Website <TrendingUp className="h-3 w-3" />
                    </a>
                )}
            </div>

            {/* Data Freshness Indicator */}
            <div className="flex items-center gap-2 mb-6 rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isTikTok ? 'bg-[#25F4EE]/10 text-[#25F4EE]' : 'bg-soft-gold/10 text-soft-gold'}`}>
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Performans Verileri</p>
                <p className="text-xs text-gray-400">
                  Son {formatDist(activeData.lastUpdated)} güncellendi. <span className={`${isTikTok ? 'text-[#25F4EE]/80' : 'text-soft-gold/80'} font-medium`}>(GÜNCEL: Son 21 Gün ve Sabitsiz)</span>
                </p>
              </div>
            </div>

            {/* Detailed Stats Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {isTikTok ? (
                    <>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition-all duration-300 hover:border-[#25F4EE]/30 hover:bg-[#25F4EE]/5">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#25F4EE]/20 text-[#25F4EE]">
                                <Users className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Takipçi</p>
                            <p className="mt-1 text-lg font-bold text-white">{(activeData.followerCount || 0).toLocaleString('tr-TR')}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition-all duration-300 hover:border-[#FE2C55]/30 hover:bg-[#FE2C55]/5">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#FE2C55]/20 text-[#FE2C55]">
                                <Heart className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Toplam Beğeni</p>
                            <p className="mt-1 text-lg font-bold text-white">{(safeStats.avg_likes || 0).toLocaleString('tr-TR')}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition-all duration-300 hover:border-[#25F4EE]/30 hover:bg-[#25F4EE]/5">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                                <Activity className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Video Sayısı</p>
                            <p className="mt-1 text-lg font-bold text-white">{safeStats.post_count.toLocaleString('tr-TR')}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition-all duration-300 hover:border-[#FE2C55]/30 hover:bg-[#FE2C55]/5">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Etkileşim Oranı</p>
                            <p className="mt-1 text-lg font-bold text-white">%{activeData.engagementRate || '4.8'}</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                                <Users className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Takipçi</p>
                            <p className="mt-1 text-lg font-bold text-white">{(activeData.followerCount || 0).toLocaleString('tr-TR')}</p>
                            {activeData.statsPayload?.changes?.follower_count && renderChange(activeData.statsPayload.changes.follower_count)}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Etkileşim</p>
                            <p className="mt-1 text-lg font-bold text-white">%{activeData.engagementRate || 0}</p>
                            {activeData.statsPayload?.changes?.engagement_rate && renderChange(activeData.statsPayload.changes.engagement_rate, true)}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                                <Heart className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Ort. Beğeni</p>
                            <p className="mt-1 text-lg font-bold text-white">{safeStats.avg_likes.toLocaleString('tr-TR')}</p>
                            {activeData.statsPayload?.changes?.avg_likes && renderChange(activeData.statsPayload.changes.avg_likes)}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <p className="text-xs uppercase tracking-wider text-gray-400">Ort. Yorum</p>
                            <p className="mt-1 text-lg font-bold text-white">{safeStats.avg_comments.toLocaleString('tr-TR')}</p>
                        </div>
                    </>
                )}

                {!isTikTok && safeStats.avg_views > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400">
                            <Activity className="h-4 w-4" />
                        </div>
                        <p className="text-xs uppercase tracking-wider text-gray-400">Ort. İzlenme</p>
                        <p className="mt-1 text-lg font-bold text-white">{safeStats.avg_views.toLocaleString('tr-TR')}</p>
                        {activeData.statsPayload?.changes?.avg_views && renderChange(activeData.statsPayload.changes.avg_views)}
                    </div>
                )}

                {!isTikTok && safeStats.posting_frequency > 0 && (
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
            <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isTikTok ? 'bg-[#25F4EE]' : 'bg-green-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isTikTok ? 'bg-[#25F4EE]' : 'bg-green-500'}`}></span>
                        </span>
                        <span>
                            {isTikTok 
                                ? 'TikTok Resmi Entegrasyonu Aktif' 
                                : 'Son 6 gönderi analiz edildi'}
                        </span>
                    </div>
                    {!isTikTok && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <AlertCircle className="h-3 w-3" />
                            <span>Not: Etkileşim verileri son paylaşılan içerikleri baz alır.</span>
                        </div>
                    )}
                </div>
                <div className="whitespace-nowrap">
                    Son Güncelleme: <span className="text-gray-300 font-medium">{new Date(activeData.lastUpdated).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
            </div>

            {/* AI Analysis Section */}
            {!hideAnalysisText && (
                <div className={`group relative overflow-hidden rounded-3xl border p-6 shadow-glow transition-all ${
                    isTikTok 
                    ? 'border-[#25F4EE]/20 bg-gradient-to-br from-[#0F1C1F] to-[#0A0D10] hover:border-[#25F4EE]/40' 
                    : 'border-soft-gold/20 bg-gradient-to-br from-[#1A1B22] to-[#0F1014] hover:border-soft-gold/40'
                }`}>
                    <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-all ${
                        isTikTok ? 'bg-[#25F4EE]/5 group-hover:bg-[#25F4EE]/10' : 'bg-soft-gold/5 group-hover:bg-soft-gold/10'
                    }`}></div>

                    {/* AI Feature Selector */}
                    <div className="mb-6 flex flex-wrap gap-2">
                        <AnalysisButton type="basic" label="Genel Özet" icon={Sparkles} requiredTier="FREE" />
                        <AnalysisButton type="match_score" label="AI Uyum Skoru" icon={Activity} requiredTier="SPOTLIGHT" />

                        {mode === 'influencer-view' && (
                            <AnalysisButton type="profile_coach" label="AI Koç" icon={Zap} requiredTier="SPOTLIGHT_PLUS" />
                        )}

                        {mode === 'brand-view' && viewerRole === 'brand' && (
                            <AnalysisButton type="campaign_analysis" label="Kampanya ROI" icon={TrendingUp} requiredTier="BRAND_PRO" />
                        )}
                    </div>

                    <div className="relative flex items-start gap-4">
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-black shadow-lg bg-gradient-to-br ${
                            isTikTok 
                            ? 'from-[#25F4EE] to-[#FE2C55]' 
                            : 'from-soft-gold to-yellow-600'
                        }`}>
                            {isPending ? <Sparkles className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-current" />}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white">
                                    {isPending ? 'Yapay Zeka Düşünüyor...' : 'Detaylı Profil Analizi'}
                                </h3>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                                    isTikTok 
                                    ? 'bg-[#25F4EE]/10 text-[#25F4EE] border-[#25F4EE]/20' 
                                    : 'bg-soft-gold/10 text-soft-gold border-soft-gold/20'
                                }`}>BETA</span>
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
                                                <TrendingUp className={`h-5 w-5 flex-shrink-0 ${isTikTok ? 'text-[#25F4EE]' : 'text-soft-gold'}`} />
                                                <p className="text-sm text-gray-200">{point}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer Info or Disclaimer */}
                                    <p className="mt-4 text-[10px] text-gray-500">
                                        * Bu analiz Influmatch Akıllı Algoritması tarafından oluşturulmuştur. Kesin yatırım tavsiyesi değildir.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Paywall Overlay */}
                    {showPaywall && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center">
                            <Lock className={`h-12 w-12 mb-4 ${isTikTok ? 'text-[#25F4EE]' : 'text-soft-gold'}`} />
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
                                    className={`rounded-xl px-6 py-2 text-sm font-bold text-black transition-colors ${
                                        isTikTok ? 'bg-[#25F4EE] hover:bg-[#25F4EE]/80' : 'bg-soft-gold hover:bg-yellow-500'
                                    }`}
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
