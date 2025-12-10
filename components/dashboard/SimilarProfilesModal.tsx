'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getSimilarInfluencers } from '@/app/actions/spotlight'
import { DiscoverInfluencer } from '@/types/influencer'

interface SimilarProfilesModalProps {
    isOpen: boolean
    onClose: () => void
    baseInfluencerId: string
    baseInfluencerName: string
}

import { createPortal } from 'react-dom'

export default function SimilarProfilesModal({ isOpen, onClose, baseInfluencerId, baseInfluencerName }: SimilarProfilesModalProps) {
    const [profiles, setProfiles] = useState<DiscoverInfluencer[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setLoading(true)
            getSimilarInfluencers(baseInfluencerId)
                .then(result => {
                    if (result.error) setError(result.error)
                    else setProfiles(result.data)
                })
                .catch(() => setError('Bir hata oluştu'))
                .finally(() => setLoading(false))
        }
    }, [isOpen, baseInfluencerId])

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#1A1B23] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                >
                    <X className="h-6 w-6" />
                </button>

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white">Benzer Profiller</h2>
                    <p className="text-sm text-gray-400">
                        <span className="text-soft-gold font-semibold">{baseInfluencerName}</span> profiline benzer yetenekler
                    </p>
                </div>

                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-soft-gold" />
                    </div>
                ) : error ? (
                    <div className="flex h-40 items-center justify-center text-red-400">
                        {error}
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-gray-500">
                        Benzer kriterlere sahip başka profil bulunamadı.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {profiles.map((profile) => (
                            <Link
                                key={profile.id}
                                href={`/profile/${profile.username}`}
                                className="group relative block overflow-hidden rounded-xl border border-white/5 bg-[#111218] transition-all hover:border-soft-gold/30 hover:shadow-lg"
                            >
                                <div className="aspect-square relative w-full bg-gray-900">
                                    {profile.avatar_url ? (
                                        <Image
                                            src={profile.avatar_url}
                                            alt={profile.full_name || ''}
                                            fill
                                            className="object-cover transition duration-300 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-xs text-gray-600">Fotoğraf Yok</div>
                                    )}
                                </div>
                                <div className="p-3">
                                    <h3 className="truncate text-sm font-bold text-white">{profile.full_name}</h3>
                                    <p className="truncate text-xs text-gray-400">@{profile.username}</p>
                                    <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                                        <span>{profile.stats?.followers} Takipçi</span>
                                        <span className="text-soft-gold">{profile.stats?.engagement}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
