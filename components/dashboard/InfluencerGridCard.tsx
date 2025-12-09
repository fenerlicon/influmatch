'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { BadgeCheck, Lock } from 'lucide-react'
import BadgeDisplay from '@/components/badges/BadgeDisplay'
import { getCategoryLabel } from '@/utils/categories'
import { toggleFavorite } from '@/app/actions/favorites'
import { type DiscoverInfluencer } from '@/types/influencer'

import AddToListModal from '@/components/dashboard/AddToListModal'

// ... existing imports ...

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

    return (
        <Link href={`/profile/${username}`} prefetch={true} className="group cursor-pointer block h-full">
            <article
                className={`flex h-full flex-col rounded-[32px] border p-4 transition duration-300 ease-out hover:-translate-y-1 ${isSpotlight
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
                            className="object-cover transition duration-500 group-hover:scale-105"
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

                    {/* Badges Row */}
                    <div className="mt-4 flex flex-wrap gap-2">
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
                                <div className="text-center border-t border-white/5 pt-2">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Ort. Beğeni</p>
                                    <p className="font-bold text-white">{influencer.stats?.avg_likes || '-'}</p>
                                </div>
                                <div className="text-center border-t border-l border-white/5 pt-2">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Ort. Yorum</p>
                                    <p className="font-bold text-white">{influencer.stats?.avg_comments || '-'}</p>
                                </div>
                            </>
                        ) : (
                            <div className="col-span-2 flex flex-col items-center justify-center py-4 text-center">
                                <Lock className="mb-2 h-5 w-5 text-gray-600" />
                                <p className="text-xs font-medium text-gray-500">Doğrulanmadı</p>
                            </div>
                        )}
                    </div>

                    {/* Data Source Footer */}
                    <div className="mt-3 text-center">
                        {matchReasons && matchReasons.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-1.5">
                                {matchReasons.slice(0, 2).map((reason, idx) => (
                                    <span key={idx} className="inline-block rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                                        {reason}
                                    </span>
                                ))}
                                {matchReasons.length > 2 && (
                                    <span className="inline-block rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                                        +{matchReasons.length - 2}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <p className="text-[9px] text-gray-600">
                                {hasStats ? 'Veriler son 12 gönderiye dayanmaktadır.' : 'Veri bulunamadı.'}
                            </p>
                        )}
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
            </article>
        </Link >
    )
}
