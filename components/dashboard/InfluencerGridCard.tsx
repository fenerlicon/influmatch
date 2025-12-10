'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { BadgeCheck, Lock } from 'lucide-react'
import BadgeDisplay from '@/components/badges/BadgeDisplay'
import { getCategoryLabel } from '@/utils/categories'
import { toggleFavorite } from '@/app/actions/favorites'
import { type DiscoverInfluencer } from '@/types/influencer'
import { toast } from 'sonner'

import AddToListModal from '@/components/dashboard/AddToListModal'
import SimilarProfilesModal from '@/components/dashboard/SimilarProfilesModal'
import { calculateTrustScore } from '@/utils/matching'
import { cn } from '@/utils/cn'

interface InfluencerGridCardProps {
    influencer: DiscoverInfluencer
    initialIsFavorited: boolean
    userRole?: string
    matchScore?: number
    matchReasons?: string[]
}

export default function InfluencerGridCard({ influencer, initialIsFavorited, userRole, matchScore, matchReasons }: InfluencerGridCardProps) {
    const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
    const [isPending, setIsPending] = useState(false)
    const [showListModal, setShowListModal] = useState(false)
    const [showSimilarModal, setShowSimilarModal] = useState(false)
    const [isFlipped, setIsFlipped] = useState(false)

    const handleToggleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (userRole !== 'brand') {
            toast.error('Sadece markalar favorilere ekleyebilir')
            return
        }

        if (isPending) return

        // Optimistic Update
        const previousState = isFavorited
        setIsFavorited(!previousState)
        setIsPending(true)

        try {
            const result = await toggleFavorite(influencer.id)
            if (result.error) {
                setIsFavorited(previousState)
                console.error(result.error)
                toast.error('İşlem başarısız oldu')
            } else {
                if (result.isFavorited !== undefined) {
                    setIsFavorited(result.isFavorited)
                }
            }
        } catch (error) {
            console.error(error)
            setIsFavorited(previousState)
            toast.error('Bir hata oluştu')
        } finally {
            setIsPending(false)
        }
    }

    const username = influencer.username || influencer.id
    const isSpotlight = influencer.spotlight_active === true
    const hasStats = influencer.stats && influencer.stats.followers !== '0'
    const showMatchDetails = (matchReasons && matchReasons.length > 0) && ((matchScore || 0) > 25)

    return (
        <div
            className="group/card relative h-full"
            onMouseLeave={() => setIsFlipped(false)}
            style={{ perspective: '1000px' }}
        >
            <div
                className={cn(
                    "relative h-full w-full transition-all duration-500",
                )}
                style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
            >
                {/* FRONT FACE */}
                <div
                    className="h-full w-full"
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    <Link href={`/profile/${username}`} prefetch={true} className="cursor-pointer block h-full">
                        <article
                            className={`flex h-full flex-col rounded-[32px] border p-4 transition duration-300 ease-out ${isSpotlight
                                ? 'border-purple-500/60 bg-[#0B0C10]/60 shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:border-purple-400 hover:shadow-[0_0_35px_rgba(168,85,247,0.6)]'
                                : 'border-white/5 bg-[#1A1B23] hover:border-white/10 hover:shadow-lg'
                                }`}
                        >
                            {/* Image Section */}
                            <div className={`relative aspect-[4/3] w-full flex-shrink-0 overflow-hidden rounded-2xl bg-[#111218] ${isSpotlight ? 'border border-purple-500/30' : ''}`}>
                                {influencer.avatar_url ? (
                                    <Image
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                        src={influencer.avatar_url}
                                        alt={influencer.full_name ?? 'Influencer'}
                                        className="object-cover transition duration-500 group-hover/card:scale-105"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                                        Fotoğraf yok
                                    </div>
                                )}

                                {matchScore && matchScore > 0 && (
                                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-1 backdrop-blur-sm">
                                        <span className="text-[10px] font-bold text-white">%{matchScore} Match</span>
                                    </div>
                                )}

                                {/* Heart Icon */}
                                <div className="absolute top-3 right-3 z-10 flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            if (userRole !== 'brand') {
                                                toast.error('Sadece markalar favorilere ekleyebilir')
                                                return
                                            }
                                            setShowListModal(true)
                                        }}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 group/btn border border-white/10 hover:border-white/30 text-white hover:text-soft-gold"
                                        title="Listeye Ekle"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 10v6M9 13h6M20 20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7.5" />
                                            <path d="M16 2v4" />
                                            <path d="M22 6h-6" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleToggleFavorite}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 group/btn"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill={isFavorited ? "#ef4444" : "none"}
                                            stroke={isFavorited ? "#ef4444" : "white"}
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="transition-colors duration-300"
                                        >
                                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                                        </svg>
                                    </button>
                                </div>

                                {/* "Neden O?" Button (Only if we have reasons and match score > 25) */}
                                {showMatchDetails && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setIsFlipped(true)
                                        }}
                                        className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-blue-600/90 px-2.5 py-1 backdrop-blur-sm text-[10px] font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 hover:bg-blue-500"
                                    >
                                        <span>?</span>
                                        <span className="ml-1">Neden O?</span>
                                    </button>
                                )}
                            </div>

                            {/* Content Section */}
                            <div className="mt-5 flex flex-1 flex-col">
                                {/* Name & Category Row */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="truncate text-lg font-bold text-white">
                                                {influencer.full_name}
                                            </h3>
                                            {influencer.displayed_badges?.includes('verified-account') && (
                                                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                            )}
                                        </div>
                                        <p className="truncate text-sm font-medium text-soft-gold">
                                            @{influencer.username}
                                        </p>
                                    </div>

                                    {influencer.category && (
                                        <span className="flex-shrink-0 rounded-xl bg-[#25262E] px-3 py-1.5 text-[10px] font-medium text-gray-300">
                                            {getCategoryLabel(influencer.category)}
                                        </span>
                                    )}
                                </div>

                                {/* Trust Score & Badges Row */}
                                <div className="mt-4 flex flex-col gap-3">
                                    {/* Trust / Anti-Bot Score Display */}
                                    {hasStats && (
                                        <div className="w-full">
                                            <div className="flex justify-between items-end mb-1">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Güven Skoru</span>
                                                <span className={cn(
                                                    "text-xs font-bold",
                                                    calculateTrustScore(influencer) > 70 ? "text-emerald-400" :
                                                        calculateTrustScore(influencer) > 40 ? "text-yellow-400" : "text-red-400"
                                                )}>
                                                    {calculateTrustScore(influencer)}/100
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all duration-500",
                                                        calculateTrustScore(influencer) > 70 ? "bg-emerald-500" :
                                                            calculateTrustScore(influencer) > 40 ? "bg-yellow-500" : "bg-red-500"
                                                    )}
                                                    style={{ width: `${calculateTrustScore(influencer)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {influencer.displayed_badges && Array.isArray(influencer.displayed_badges) && (
                                        <BadgeDisplay
                                            badgeIds={influencer.displayed_badges.filter((id): id is string => typeof id === 'string' && id.length > 0)}
                                            userRole="influencer"
                                            size="small"
                                            maxDisplay={2}
                                        />
                                    )}
                                </div>

                                {/* Stats Grid */}
                                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#111218] p-3">
                                    {hasStats ? (
                                        <>
                                            <div className="text-center">
                                                <p className="text-[10px] uppercase tracking-wider text-gray-500">Takipçi</p>
                                                <p className="font-bold text-white">{influencer.stats?.followers}</p>
                                            </div>
                                            <div className="text-center border-l border-white/5">
                                                <p className="text-[10px] uppercase tracking-wider text-gray-500">Etkileşim</p>
                                                <p className="font-bold text-soft-gold">{influencer.stats?.engagement}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2 flex flex-col items-center justify-center py-4 text-center">
                                            <Lock className="mb-2 h-5 w-5 text-gray-600" />
                                            <p className="text-xs font-medium text-gray-500">Doğrulanmadı</p>
                                        </div>
                                    )}
                                </div>

                                {/* Look-alike / Similar Profiles Button */}
                                {userRole === 'brand' && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setShowSimilarModal(true)
                                        }}
                                        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        ⚡ Benzer Profilleri Gör
                                    </button>
                                )}
                            </div>
                        </article>
                    </Link>
                </div>

                {/* BACK FACE (AI Analysis) */}
                <div
                    className="absolute inset-0 h-full w-full rounded-[32px] border border-blue-500/30 bg-[#0B0C10] p-6 shadow-[0_0_30px_rgba(59,130,246,0.2)] flex flex-col pointer-events-auto"
                    style={{
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden'
                    }}
                >
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                                <span className="text-lg">🤖</span>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">AI Analizi</h4>
                                <p className="text-[10px] text-gray-400">Neden bu profil?</p>
                            </div>
                        </div>
                        <div className="rounded-full bg-blue-500/10 px-2 py-0.5 border border-blue-500/20">
                            <span className="text-xs font-bold text-blue-400">%{matchScore}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        <div className="space-y-3">
                            {matchReasons && matchReasons.map((reason, idx) => (
                                <div key={idx} className="rounded-xl bg-white/5 p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                        <p className="text-xs font-bold text-gray-200">{reason}</p>
                                    </div>
                                    <p className="text-[10px] text-gray-400 pl-3.5">
                                        {reason === 'Kategori Eşleşmesi' && `Markanızla aynı sektörde (${getCategoryLabel(influencer.category || '')}) içerik üretiyor.`}
                                        {reason === 'Yüksek Etkileşim' && `Takipçi kitlesi oldukça aktif (%${influencer.stats?.engagement}).`}
                                        {reason === 'Geniş Aktif Kitle' && 'Geniş bir kitleye hitap ediyor ve erişimi yüksek.'}
                                        {reason === 'Güvenilir Profil' && 'Bot aktivitesi düşük, organik etkileşim sinyalleri güçlü.'}
                                        {reason === 'Spotlight Üyesi' && 'Platform tarafından doğrulanmış ve öne çıkan üye.'}
                                        {reason === 'Doğrulanmış Hesap' && 'Kimliği ve istatistikleri doğrulanmış.'}
                                        {!['Kategori Eşleşmesi', 'Yüksek Etkileşim', 'Geniş Aktif Kitle', 'Güvenilir Profil', 'Spotlight Üyesi', 'Doğrulanmış Hesap'].includes(reason) && 'Bu profil kriterlerinize uygun özellikler taşıyor.'}
                                    </p>
                                </div>
                            ))}

                            {!matchReasons?.length && (
                                <p className="text-center text-xs text-gray-500 py-4">
                                    Detaylı analiz verisi bulunamadı.
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsFlipped(false)
                        }}
                        className="mt-4 w-full rounded-xl bg-white/5 py-2 text-xs font-semibold text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        Geri Dön
                    </button>
                </div>
            </div>

            {showListModal && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <AddToListModal
                        isOpen={showListModal}
                        onClose={() => setShowListModal(false)}
                        influencerId={influencer.id}
                    />
                </div>
            )}

            {showSimilarModal && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <SimilarProfilesModal
                        isOpen={showSimilarModal}
                        onClose={() => setShowSimilarModal(false)}
                        baseInfluencerId={influencer.id}
                        baseInfluencerName={influencer.full_name || influencer.username || ''}
                    />
                </div>
            )}
        </div>
    )
}
