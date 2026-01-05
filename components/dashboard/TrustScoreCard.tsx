'use client'

import { Info, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/utils/cn'

interface TrustScoreCardProps {
    score: number
    details?: {
        verificationStatus: string
        spotlightActive: boolean
        profileComplete: boolean
        engagementRate: number
    }
}

export default function TrustScoreCard({ score, details }: TrustScoreCardProps) {
    const [showInfo, setShowInfo] = useState(false)

    // Analyze score for color and status
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-emerald-500' // High
        if (s >= 50) return 'text-yellow-500' // Medium
        return 'text-red-500' // Low
    }

    const getScoreBg = (s: number) => {
        if (s >= 80) return 'bg-emerald-500'
        if (s >= 50) return 'bg-yellow-500'
        return 'bg-red-500'
    }

    const getLabel = (s: number) => {
        if (s >= 80) return 'Mükemmel'
        if (s >= 50) return 'Ortalama'
        return 'Riskli'
    }

    const circumference = 2 * Math.PI * 38 // Radius 38
    const offset = circumference - (score / 100) * circumference

    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow transition-all hover:border-white/20">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Marka Güven Skoru</h3>
                    <p className="text-sm text-gray-400">Markaların sizi nasıl gördüğünü yansıtır.</p>
                </div>
                {details?.spotlightActive && (
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="rounded-full bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <Info className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className="relative mt-6">
                {!details?.spotlightActive && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-2 rounded-full border border-soft-gold/30 bg-soft-gold/10 px-3 py-1.5 text-xs font-semibold text-soft-gold">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Premium Özellik
                        </div>
                        <p className="mt-2 text-center text-xs text-gray-400 px-4">
                            Skorunuzu görmek için Spotlight Basic veya Pro pakete geçin.
                        </p>
                        <a href="/dashboard/spotlight" className="mt-3 text-xs font-bold text-white underline hover:text-soft-gold">
                            Paketleri İncele
                        </a>
                    </div>
                )}

                <div className={cn("flex items-center gap-8", !details?.spotlightActive && "blur-sm opacity-50 select-none pointer-events-none")}>
                    {/* Circular Progress */}
                    <div className="relative h-24 w-24 flex-shrink-0">
                        <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 100 100">
                            {/* Background Circle */}
                            <circle
                                className="text-white/5"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="38"
                                cx="50"
                                cy="50"
                            />
                            {/* Progress Circle */}
                            <circle
                                className={cn("transition-all duration-1000 ease-out", getScoreColor(score))}
                                strokeWidth="8"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="38"
                                cx="50"
                                cy="50"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={cn("text-2xl font-bold", getScoreColor(score))}>
                                {score}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className={cn("h-2.5 w-2.5 rounded-full", getScoreBg(score))} />
                            <span className="font-medium text-white">{getLabel(score)} Seviye</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {score >= 80
                                ? "Harika! Profiliniz markalar için oldukça güvenilir görünüyor."
                                : score >= 50
                                    ? "İyi, ancak profilinizi geliştirerek daha fazla iş alabilirsiniz."
                                    : "Dikkat! Düşük skor marka işbirliklerini olumsuz etkileyebilir."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Educational Info Modal/Panel */}
            {showInfo && details?.spotlightActive && (
                <div className="absolute inset-0 z-20 flex flex-col bg-[#151621] p-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="mb-4 flex items-center justify-between">
                        <h4 className="font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-soft-gold" />
                            Skor Nasıl Yükselir?
                        </h4>
                        <button
                            onClick={() => setShowInfo(false)}
                            className="text-xs font-semibold text-gray-400 hover:text-white"
                        >
                            KAPAT
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {/* 1. Hesap Doğrulama */}
                        <div className={cn("flex items-start gap-3 rounded-xl p-3 transition-colors",
                            details?.verificationStatus === 'verified' ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/5 opacity-50"
                        )}>
                            <CheckCircle2 className={cn("h-4 w-4 mt-0.5 shrink-0",
                                details?.verificationStatus === 'verified' ? "text-emerald-400" : "text-gray-500"
                            )} />
                            <div>
                                <p className={cn("text-xs font-bold", details?.verificationStatus === 'verified' ? "text-emerald-200" : "text-gray-200")}>
                                    Hesap Doğrulama (+30 Puan)
                                </p>
                                <p className="text-[10px] text-gray-400">Instagram hesabınızı bağlayın ve doğrulayın.</p>
                            </div>
                        </div>

                        {/* 2. Sağlıklı Etkileşim */}
                        <div className={cn("flex items-start gap-3 rounded-xl p-3 transition-colors",
                            (details?.engagementRate >= 0.01 && details?.engagementRate <= 0.10) ? "bg-blue-500/10 border border-blue-500/20" : "bg-white/5 opacity-50"
                        )}>
                            <TrendingUp className={cn("h-4 w-4 mt-0.5 shrink-0",
                                (details?.engagementRate >= 0.01 && details?.engagementRate <= 0.10) ? "text-blue-400" : "text-gray-500"
                            )} />
                            <div>
                                <p className={cn("text-xs font-bold", (details?.engagementRate >= 0.01 && details?.engagementRate <= 0.10) ? "text-blue-200" : "text-gray-200")}>
                                    Sağlıklı Etkileşim (+20 Puan)
                                </p>
                                <p className="text-[10px] text-gray-400">%1 - %10 arası etkileşim oranı en idealdir.</p>
                            </div>
                        </div>

                        {/* 3. Spotlight Üyeliği */}
                        <div className={cn("flex items-start gap-3 rounded-xl p-3 transition-colors",
                            details?.spotlightActive ? "bg-soft-gold/10 border border-soft-gold/20" : "bg-white/5 opacity-50"
                        )}>
                            <ShieldCheck className={cn("h-4 w-4 mt-0.5 shrink-0",
                                details?.spotlightActive ? "text-soft-gold" : "text-gray-500"
                            )} />
                            <div>
                                <p className={cn("text-xs font-bold", details?.spotlightActive ? "text-soft-gold" : "text-gray-200")}>
                                    Spotlight Üyeliği (+10 Puan)
                                </p>
                                <p className="text-[10px] text-gray-400">Premium üyelik güvenilirliğinizi artırır.</p>
                            </div>
                        </div>

                        {/* 4. Profil Doluluğu */}
                        <div className={cn("flex items-start gap-3 rounded-xl p-3 transition-colors",
                            details?.profileComplete ? "bg-purple-500/10 border border-purple-500/20" : "bg-white/5 opacity-50"
                        )}>
                            <Info className={cn("h-4 w-4 mt-0.5 shrink-0",
                                details?.profileComplete ? "text-purple-400" : "text-gray-500"
                            )} />
                            <div>
                                <p className={cn("text-xs font-bold", details?.profileComplete ? "text-purple-200" : "text-gray-200")}>
                                    Profil Doluluğu (+10 Puan)
                                </p>
                                <p className="text-[10px] text-gray-400">Biyografi, kategori ve iletişim bilgilerinizi tamamlayın.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
