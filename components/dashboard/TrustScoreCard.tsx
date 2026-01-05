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
                <button
                    onClick={() => setShowInfo(!showInfo)}
                    className="rounded-full bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                    <Info className="h-5 w-5" />
                </button>
            </div>

            <div className="mt-6 flex items-center gap-8">
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

            {/* Educational Info Modal/Panel */}
            {showInfo && (
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
                        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                            <CheckCircle2 className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-gray-200">Hesap Doğrulama (+30 Puan)</p>
                                <p className="text-[10px] text-gray-400">Instagram hesabınızı bağlayın ve doğrulayın.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                            <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-gray-200">Sağlıklı Etkileşim (+20 Puan)</p>
                                <p className="text-[10px] text-gray-400">%1 - %10 arası etkileşim oranı en idealdir.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                            <CheckCircle2 className="h-4 w-4 text-soft-gold mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-gray-200">Spotlight Üyeliği (+10 Puan)</p>
                                <p className="text-[10px] text-gray-400">Premium üyelik güvenilirliğinizi artırır.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                            <Info className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-gray-200">Profil Doluluğu (+10 Puan)</p>
                                <p className="text-[10px] text-gray-400">Biyografi, kategori ve iletişim bilgilerinizi tamamlayın.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
