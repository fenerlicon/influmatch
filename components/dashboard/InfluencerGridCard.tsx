'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { BadgeCheck, Lock, Sparkles } from 'lucide-react'
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
    isSpotlightMember?: boolean
}

export default function InfluencerGridCard({ influencer, initialIsFavorited, userRole, matchScore, matchReasons, isSpotlightMember = false }: InfluencerGridCardProps) {
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
    
    // Robust check if the influencer actually has scraped stats (followers > 0)
    const hasStats = !!(
        influencer.platforms_data && 
        influencer.platforms_data.length > 0 && 
        influencer.platforms_data.some(p => p.follower_count !== null && p.follower_count > 0)
    ) || !!(
        influencer.stats && 
        influencer.stats.followers !== '0' && 
        influencer.stats.followers !== '0%' && 
        influencer.stats.followers !== null
    )
    
    const showMatchDetails = (matchReasons && matchReasons.length > 0) && ((matchScore || 0) > 25)

    // Verification Logic: Blue tick ONLY if they have the verified-account badge (completed bio check)
    const isVerified = influencer.displayed_badges?.includes('verified-account')

    const isSpotlightUser = isSpotlightMember

    // Handle Similar Profiles Click
    const handleSimilarProfilesClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!isSpotlightUser) {
            // Redirect to appropriate spotlight page based on role
            if (userRole === 'influencer') {
                window.location.href = '/dashboard/influencer/spotlight'
            } else {
                window.location.href = '/dashboard/spotlight/brand'
            }
            return
        }

        setShowSimilarModal(true)
    }

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
                                        unoptimized
                                        style={{ imageOrientation: 'from-image' }}
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

                                {/* Favorite/Save Buttons */}
                                <div className="absolute top-3 right-3 z-10 flex gap-2">
                                    {userRole === 'brand' && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
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
                                    )}
                                    {userRole === 'brand' && (
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
                                    )}
                                </div>

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
                                            <h3 className="truncate text-lg font-bold text-white leading-tight">
                                                {influencer.full_name}
                                            </h3>
                                            {isVerified && (
                                                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          <p className="truncate text-sm font-medium text-soft-gold/80">
                                              @{influencer.username}
                                          </p>
                                          {/* Platform Icons */}
                                          <div className="flex items-center gap-1">
                                            {(influencer.platforms?.includes('instagram') || influencer.platform === 'instagram') && (
                                              <span className="p-0.5 rounded bg-white/5 text-pink-500 hover:text-pink-400" title="Instagram">
                                                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                                                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                                </svg>
                                              </span>
                                            )}
                                            {(influencer.platforms?.includes('tiktok') || influencer.platform === 'tiktok') && (
                                              <span className="p-0.5 rounded bg-white/5 text-[#25F4EE] hover:text-[#25F4EE]/80" title="TikTok">
                                                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                                                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
                                                </svg>
                                              </span>
                                            )}
                                          </div>
                                          {/* Mini Badge Row right under name */}
                                          {influencer.displayed_badges && Array.isArray(influencer.displayed_badges) && influencer.displayed_badges.length > 0 && (
                                              <BadgeDisplay
                                                  badgeIds={influencer.displayed_badges.filter((id): id is string => typeof id === 'string' && id.length > 0)}
                                                  userRole="influencer"
                                                  size="small"
                                                  maxDisplay={1} // Show 1 core badge here to keep it clean
                                              />
                                          )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        {influencer.category && (
                                            <span className="rounded-xl bg-[#25262E] px-2.5 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                {getCategoryLabel(influencer.category)}
                                            </span>
                                        )}
                                        <span className={cn(
                                            "rounded-xl px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border",
                                            influencer.creator_type === 'ugc'
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : influencer.creator_type === 'both'
                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                        )}>
                                            {influencer.creator_type === 'ugc'
                                                ? 'UGC'
                                                : influencer.creator_type === 'both'
                                                    ? 'UGC & INF'
                                                    : 'Influencer'}
                                        </span>
                                    </div>
                                </div>

                                {/* Trust Score (Brands Only) */}
                                <div className="mt-4 flex flex-col gap-2 min-h-[42px] justify-center">
                                    {hasStats && userRole !== 'influencer' && (
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
                                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
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
                                    
                                    {/* Additional Badges area if more are needed */}
                                    {influencer.displayed_badges && influencer.displayed_badges.length > 1 && (
                                        <div className="flex items-center">
                                            <BadgeDisplay
                                                badgeIds={influencer.displayed_badges.slice(1).filter((id): id is string => typeof id === 'string' && id.length > 0)}
                                                userRole="influencer"
                                                size="small"
                                                maxDisplay={1}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Stats Grid - Stay aligned at bottom */}
                                <div className="mt-auto pt-2 space-y-2">
                                    {hasStats && influencer.platforms_data && influencer.platforms_data.length > 0 ? (
                                        influencer.platforms_data.map((plat) => {
                                            const isTikTok = plat.platform === 'tiktok'
                                            return (
                                                <div key={plat.platform} className="grid grid-cols-2 gap-3 rounded-2xl bg-[#111218]/50 p-2 border border-white/5">
                                                    <div className="flex items-center gap-1.5 pl-2">
                                                        {isTikTok ? (
                                                            <span className="p-1 rounded bg-[#25F4EE]/10 text-[#25F4EE]" title="TikTok">
                                                                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                                                                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
                                                                </svg>
                                                            </span>
                                                        ) : (
                                                            <span className="p-1 rounded bg-pink-500/10 text-pink-500" title="Instagram">
                                                                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                                                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                                                </svg>
                                                            </span>
                                                        )}
                                                        <div>
                                                            <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-none mb-0.5">Takipçi</p>
                                                            <p className="text-xs font-bold text-white leading-none">{plat.followers}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-left border-l border-white/10 pl-3">
                                                        <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-none mb-0.5">Etkileşim</p>
                                                        <p className={`text-xs font-bold leading-none ${isTikTok ? 'text-[#25F4EE]' : 'text-soft-gold'}`}>{plat.engagement}</p>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : hasStats && influencer.stats && influencer.stats.followers !== '0' && influencer.stats.followers !== null ? (
                                        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#111218]/50 p-2.5 border border-white/5">
                                            <div className="text-center">
                                                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Takipçi</p>
                                                <p className="text-sm font-bold text-white">{influencer.stats?.followers}</p>
                                            </div>
                                            <div className="text-center border-l border-white/10">
                                                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Etkileşim</p>
                                                <p className="text-sm font-bold text-soft-gold">{influencer.stats?.engagement}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center py-2.5 text-center gap-2 rounded-2xl bg-[#111218]/50 border border-white/5">
                                            <Lock className="h-3 w-3 text-gray-600" />
                                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Doğrulanmadı</p>
                                        </div>
                                    )}
                                </div>

                                {/* Look-alike Button */}
                                <button
                                    onClick={handleSimilarProfilesClick}
                                    className="group/similar mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    <Sparkles className={cn("h-3.5 w-3.5", isSpotlightUser ? "text-cyan-400" : "text-gray-500")} />
                                    <span>Benzer Profilleri Gör</span>
                                    {!isSpotlightUser && <Lock className="ml-auto h-3 w-3 text-gray-500" />}
                                </button>
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
