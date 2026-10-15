'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ExternalLink, Lock, Sparkles, TrendingUp } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Chip, Segmented, StatCard } from '@/components/ui'
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
        // Etkileşim verisi yoksa uydurma bir oran varsayılmaz; o cümle atlanır.
        const eRate = activeData?.engagementRate || 0

        if (isTikTok) {
            if (eRate > 6) analyses.push("TikTok üzerinde dikkat çekici derecede yüksek etkileşime sahip.")
            else if (eRate > 4) analyses.push("İyi düzeyde bir TikTok etkileşim oranı var.")
            else if (eRate > 0) analyses.push("TikTok algoritmasında stabil ve düzenli bir izleyici etkileşimi var.")

            if (fCount > 100000) analyses.push("Geniş kitlelere ulaşan popüler TikTok içerik üreticisi.")
            else if (fCount > 10000) analyses.push("Niş kitlelere hitap eden, büyümekte olan TikTok hesabı.")
            else analyses.push("Yüksek büyüme potansiyeline sahip mikro TikTok üreticisi.")

            if (safeStats.avg_likes > 50000) {
                analyses.push("Gönderileri yüksek beğeni topluyor ve viral potansiyeli yüksek.")
            }
        } else {
            if (eRate > 5) analyses.push("Yüksek etkileşim oranıyla dikkat çekiyor.")
            else if (eRate > 3) analyses.push("İyi düzeyde bir etkileşim oranına sahip.")
            else if (eRate > 0) analyses.push("Gelişmekte olan bir etkileşim grafiği var.")

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
        setLastAnalysisType('basic')
        setCurrentAnalysis(generateStaticAnalysis())
    }, [activePlatform, activeData])

    const handleRunAnalysis = (type: AnalysisType) => {
        // Tier Check (Simple client-side pre-check)
        const requiredTier = {
            'basic': 'FREE',
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
                setCurrentAnalysis(result.analysis)
                setLastAnalysisType(type)
                toast.success('Profil analizi tamamlandı!')
            }
        })
    }

    const permissionOrder: SubscriptionTier[] = ['FREE', 'SPOTLIGHT', 'SPOTLIGHT_PLUS', 'BRAND_PRO']
    const isLockedFor = (requiredTier: SubscriptionTier) => permissionOrder.indexOf(subscriptionTier) < permissionOrder.indexOf(requiredTier)

    const analysisOptions: { type: AnalysisType; label: string; requiredTier: SubscriptionTier }[] = [
        { type: 'basic', label: 'Genel özet', requiredTier: 'FREE' },
        ...(mode === 'brand-view' && viewerRole === 'brand'
            ? [{ type: 'campaign_analysis' as AnalysisType, label: 'Kampanya ROI', requiredTier: 'BRAND_PRO' as SubscriptionTier }]
            : []),
    ]

    const handleUpgrade = () => {
        const isBrand = viewerRole === 'brand' || mode === 'brand-view'
        const targetPath = isBrand ? '/dashboard/spotlight/brand' : '/dashboard/spotlight/influencer'
        router.push(targetPath)
    }

    const renderChange = (value?: number, isPercent: boolean = false) => {
        if (!value || value === 0) return null
        const isPositive = value > 0
        return (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>
                {isPositive ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
                {isPositive ? '+' : ''}{value.toLocaleString('tr-TR')}{isPercent ? '%' : ''}
            </span>
        )
    }

    if (!activeData) return null

    const changes = activeData.statsPayload?.changes
    const fmt = (n: number) => n.toLocaleString('tr-TR')

    return (
        <div className="grid gap-4">
            {hasInstagram && hasTikTok && (
                <Segmented
                    label="Platform"
                    value={activePlatform}
                    onSelect={(v) => setActivePlatform(v as 'instagram' | 'tiktok')}
                    items={[
                        { value: 'instagram', label: 'Instagram' },
                        { value: 'tiktok', label: 'TikTok' },
                    ]}
                    className="w-fit"
                />
            )}

            <Card>
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
                    <span className="text-[14px] font-medium text-ink">@{activeData.username || 'bağlı-hesap'}</span>
                    <span className="text-xs text-ink-faint">{isTikTok ? 'TikTok' : 'Instagram'}</span>
                    {safeStats.is_verified && <Chip tone="info">Onaylı hesap</Chip>}
                    {safeStats.category_name && <Chip>{safeStats.category_name}</Chip>}
                    {safeStats.external_url && (
                        <a href={safeStats.external_url} target="_blank" rel="noopener noreferrer nofollow" className="ml-auto inline-flex items-center gap-1 text-xs text-gold hover:underline">
                            Web sitesi <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                    )}
                </div>
                <CardBody className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {isTikTok ? (
                            <>
                                <StatCard label="Takipçi" value={fmt(activeData.followerCount || 0)} />
                                <StatCard label="Toplam beğeni" value={fmt(safeStats.avg_likes || 0)} />
                                <StatCard label="Video sayısı" value={fmt(safeStats.post_count)} />
                                <StatCard label="Etkileşim oranı" value={activeData.engagementRate ? `%${activeData.engagementRate}` : '—'} />
                            </>
                        ) : (
                            <>
                                <StatCard label="Takipçi" value={fmt(activeData.followerCount || 0)} detail={renderChange(changes?.follower_count)} />
                                <StatCard label="Etkileşim" value={activeData.engagementRate ? `%${activeData.engagementRate}` : '—'} detail={renderChange(changes?.engagement_rate, true)} />
                                <StatCard label="Ort. beğeni" value={fmt(safeStats.avg_likes)} detail={renderChange(changes?.avg_likes)} />
                                <StatCard label="Ort. yorum" value={fmt(safeStats.avg_comments)} />
                                {safeStats.avg_views > 0 && <StatCard label="Ort. izlenme" value={fmt(safeStats.avg_views)} detail={renderChange(changes?.avg_views)} />}
                                {safeStats.posting_frequency > 0 && <StatCard label="Paylaşım sıklığı" value={`${safeStats.posting_frequency} günde bir`} />}
                            </>
                        )}
                    </div>
                    <p className="text-xs text-ink-faint">
                        {isTikTok ? 'Herkese açık TikTok profilinden alındı' : 'Son gönderiler analiz edildi; etkileşim son paylaşımları baz alır'} · Son güncelleme {formatDist(activeData.lastUpdated)} (
                        {new Date(activeData.lastUpdated).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })})
                    </p>
                </CardBody>
            </Card>

            {!hideAnalysisText && (
                <Card className="relative overflow-hidden">
                    <CardHeader
                        title={
                            <span className="inline-flex items-center gap-2">
                                {isPending ? 'Analiz ediliyor…' : 'Profil analizi'}
                                <Chip tone="gold">Beta</Chip>
                            </span>
                        }
                        action={
                            <div className="flex flex-wrap gap-1.5">
                                {analysisOptions.map((o) => {
                                    const locked = isLockedFor(o.requiredTier)
                                    const active = lastAnalysisType === o.type && !locked
                                    return (
                                        <Button
                                            key={o.type}
                                            size="sm"
                                            variant={active ? 'secondary' : 'ghost'}
                                            disabled={isPending}
                                            onClick={() => handleRunAnalysis(o.type)}
                                            leftIcon={locked ? <Lock /> : <Sparkles />}
                                        >
                                            {o.label}
                                        </Button>
                                    )
                                })}
                            </div>
                        }
                    />
                    <CardBody>
                        {isPending ? (
                            <div className="grid gap-2" aria-hidden>
                                <div className="h-4 w-3/4 animate-pulse rounded bg-surface-3" />
                                <div className="h-4 w-1/2 animate-pulse rounded bg-surface-3" />
                                <div className="h-4 w-2/3 animate-pulse rounded bg-surface-3" />
                            </div>
                        ) : (
                            <>
                                <ul className="grid gap-2">
                                    {currentAnalysis.map((point, index) => (
                                        <li key={index} className="flex gap-2.5 text-[13.5px] text-ink">
                                            <TrendingUp className="mt-0.5 h-4 w-4 flex-none text-gold" aria-hidden />
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-3 text-[11px] text-ink-faint">Bu analiz otomatik oluşturulur; bilgi amaçlıdır, sonuç garantisi değildir.</p>
                            </>
                        )}
                    </CardBody>

                    {showPaywall && (
                        <div className="absolute inset-0 z-10 grid place-items-center bg-surface-1/95 p-6 text-center backdrop-blur-sm">
                            <div className="grid justify-items-center gap-2">
                                <Lock className="h-8 w-8 text-gold" aria-hidden />
                                <p className="text-[15px] font-medium text-ink">Bu özellik pakete dahil</p>
                                <p className="max-w-sm text-[13px] text-ink-muted">Kampanya ROI analizi markalar için Spotlight Pro paketine dahildir.</p>
                                <div className="mt-2 flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setShowPaywall(null)}>Vazgeç</Button>
                                    <Button size="sm" variant="primary" onClick={handleUpgrade}>Paketleri gör</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    )
}
