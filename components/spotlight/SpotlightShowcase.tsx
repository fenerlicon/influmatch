'use client'

import { ArrowUpRight, Crown, Eye, ShieldCheck, Users, Target, BarChart3, Sparkles, Zap } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/utils/cn'

export default function SpotlightShowcase() {
    const [activeTab, setActiveTab] = useState<'influencer' | 'brand'>('influencer')

    return (
        <div className="mx-auto max-w-7xl space-y-16 py-20">
            <div className="text-center space-y-6">
                <div className="space-y-4">
                    <h2 className="text-3xl font-bold md:text-5xl">
                        <span className="text-white">Spotlight</span> <span className="text-soft-gold">Etkisi</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Spotlight paketleri sadece özellik değil, gerçek sonuçlar sunar. İşte hesabınızda yaşanacak değişimler.
                    </p>
                </div>

                {/* Toggle */}
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
                    <button
                        onClick={() => setActiveTab('influencer')}
                        className={cn(
                            "rounded-full px-6 py-2 text-sm font-medium transition-all duration-300",
                            activeTab === 'influencer'
                                ? "bg-soft-gold text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        Influencer
                    </button>
                    <button
                        onClick={() => setActiveTab('brand')}
                        className={cn(
                            "rounded-full px-6 py-2 text-sm font-medium transition-all duration-300",
                            activeTab === 'brand'
                                ? "bg-soft-gold text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        Marka
                    </button>
                </div>
            </div>

            <div className="relative min-h-[500px]">
                {activeTab === 'influencer' ? (
                    <div className="grid gap-12 lg:grid-cols-3 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RankingShowcase />
                        <VisibilityShowcase />
                        <PurpleBorderShowcase title="PRESTİJ & ÇERÇEVE" description="Profilinizi saran özel mor spotlight çerçevesi ile toplulukta fark yaratın." />
                    </div>
                ) : (
                    <div className="grid gap-12 lg:grid-cols-3 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <BrandMatchShowcase />
                        <BrandAnalyticsShowcase />
                        <BrandFeaturedShowcase />
                    </div>
                )}
            </div>
        </div>
    )
}

// --- STATIC ANIMATION COMPONENTS ---

function RankingShowcase() {
    return (
        <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-1 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-soft-gold/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full space-y-8 p-6 md:p-8 flex flex-col">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-soft-gold/20 bg-soft-gold/10 px-3 py-1 text-xs font-bold text-soft-gold">
                        <ArrowUpRight className="h-3 w-3" />
                        SIRALAMA ETKİSİ
                    </div>
                    <h3 className="text-2xl font-bold text-white">Zirveye Yerleşin</h3>
                    <p className="text-sm text-gray-400">
                        Spotlight profilleri, marka aramalarında ve keşfet sayfalarında daima en üstte listelenir.
                    </p>
                </div>
                <div className="relative h-48 overflow-hidden rounded-2xl bg-black/50 border border-white/5 p-4 flex flex-col justify-end gap-3 mt-auto">
                    {[1, 2].map((i) => (
                        <div key={i} className="h-10 w-full rounded-lg bg-white/5 border border-white/5 opacity-30" />
                    ))}

                    {/* Animated Card Rising */}
                    <div className="absolute bottom-4 left-4 right-4 h-12 rounded-xl bg-gradient-to-r from-soft-gold/20 to-soft-gold/5 border border-soft-gold/30 flex items-center px-4 gap-3 z-10 animate-[rise_4s_ease-in-out_infinite]">
                        <div className="h-6 w-6 rounded-full bg-soft-gold/20 flex items-center justify-center">
                            <Crown className="h-3 w-3 text-soft-gold" />
                        </div>
                        <div className="h-2 w-20 rounded bg-soft-gold/40" />
                        <div className="ml-auto h-2 w-8 rounded bg-soft-gold/20" />
                    </div>
                    <style jsx>{`
                        @keyframes rise {
                            0%, 100% { transform: translateY(0); box-shadow: 0 0 0 transparent; }
                            50% { transform: translateY(-110%); box-shadow: 0 10px 30px rgba(212,175,55,0.2); }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    )
}

function VisibilityShowcase() {
    return (
        <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-1 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full space-y-8 p-6 md:p-8 flex flex-col">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-400">
                        <Eye className="h-3 w-3" />
                        GÖRÜNÜRLÜK ARTIŞI
                    </div>
                    <h3 className="text-2xl font-bold text-white">Keşfedilme Hızı</h3>
                    <p className="text-sm text-gray-400">
                        Profil görüntülenmeleriniz ve etkileşim oranlarınız roket hızıyla artışa geçer.
                    </p>
                </div>
                <div className="relative h-48 rounded-2xl bg-black/50 border border-white/5 p-6 flex flex-col justify-end mt-auto">
                    <div className="absolute top-4 right-4 text-xs font-mono text-blue-400">
                        8.500+ Görüntülenme
                    </div>
                    <div className="flex items-end gap-2 h-32 pl-2 border-l border-white/10 border-b pb-2">
                        {[20, 35, 30, 45, 40, 60, 55, 80, 75, 100].map((height, i) => (
                            <div
                                key={i}
                                className="w-full bg-blue-500/80 rounded-t-sm"
                                style={{
                                    height: `${height}%`,
                                    animation: `grow-bar 2s ease-in-out infinite`,
                                    animationDelay: `${i * 0.1}s`
                                }}
                            />
                        ))}
                    </div>
                    <style jsx>{`
                        @keyframes grow-bar {
                            0%, 100% { transform: scaleY(1); opacity: 0.8; }
                            50% { transform: scaleY(1.1); opacity: 1; }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    )
}

function PurpleBorderShowcase({ title, description, isBrand = false }: { title: string, description: string, isBrand?: boolean }) {
    return (
        <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-1 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full space-y-8 p-6 md:p-8 flex flex-col">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-400">
                        <Sparkles className="h-3 w-3" />
                        {title}
                    </div>
                    <h3 className="text-2xl font-bold text-white">Spotlight Çerçevesi</h3>
                    <p className="text-sm text-gray-400">
                        {description}
                    </p>
                </div>
                <div className="relative h-48 flex items-center justify-center rounded-2xl bg-black/50 border border-white/5 overflow-hidden mt-auto">
                    <div className="relative">
                        {/* Glow Effect */}
                        <div className="absolute -inset-4 rounded-full bg-purple-600/30 blur-xl animate-pulse" />

                        {/* Avatar with Animated Border */}
                        <div className="relative h-24 w-24 rounded-full bg-[#1A1B23] flex items-center justify-center z-10 p-[4px]">
                            {/* Rotating Gradient Border */}
                            <div className="absolute inset-0 rounded-full animate-[spin_3s_linear_infinite]"
                                style={{ background: 'conic-gradient(from 0deg, transparent 0deg, #9333ea 120deg, transparent 120deg)' }}
                            />
                            {/* Inner Mask */}
                            <div className="absolute inset-[3px] rounded-full bg-[#0F1014] z-10" />

                            {/* Inner Content */}
                            <div className="relative z-20 flex flex-col items-center justify-center gap-1">
                                {isBrand ? (
                                    <ShieldCheck className="h-8 w-8 text-gray-400" />
                                ) : (
                                    <Users className="h-8 w-8 text-gray-400" />
                                )}
                            </div>
                        </div>

                        {/* Status Label */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-full bg-purple-600 px-3 py-0.5 text-[10px] font-bold text-white shadow-lg animate-bounce">
                            SPOTLIGHT
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function BrandMatchShowcase() {
    return (
        <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-1 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full space-y-8 p-6 md:p-8 flex flex-col">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                        <Target className="h-3 w-3" />
                        AI EŞLEŞME
                    </div>
                    <h3 className="text-2xl font-bold text-white">Akıllı Eşleşme</h3>
                    <p className="text-sm text-gray-400">
                        Yapay zeka algoritmaları, markanız için en doğru influencerları anında tespit eder ve önerir.
                    </p>
                </div>
                <div className="relative h-48 rounded-2xl bg-black/50 border border-white/5 overflow-hidden flex items-center justify-center mt-auto">
                    {/* Radar Circles */}
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="absolute rounded-full border border-emerald-500/30 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"
                            style={{ height: i * 60, width: i * 60, animationDelay: `${i * 0.5}s` }}
                        />
                    ))}
                    {/* Scanning Line */}
                    <div className="absolute h-1/2 w-[2px] bg-gradient-to-b from-transparent to-emerald-400 origin-bottom top-0 left-1/2 animate-[spin_3s_linear_infinite]" />

                    {/* Dots appearing */}
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse"
                            style={{
                                top: `${20 + (i * 15)}%`,
                                left: `${20 + (i * 20)}%`
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function BrandAnalyticsShowcase() {
    return (
        <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-1 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full space-y-8 p-6 md:p-8 flex flex-col">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400">
                        <BarChart3 className="h-3 w-3" />
                        DERİN ANALİZ
                    </div>
                    <h3 className="text-2xl font-bold text-white">Veri Odaklı Karar</h3>
                    <p className="text-sm text-gray-400">
                        İlanlarınızın görüntülenme ve etkileşim performansını grafiklerle takip edin.
                    </p>
                </div>
                <div className="relative h-48 rounded-2xl bg-black/50 border border-white/5 p-4 flex flex-col justify-center gap-3 mt-auto">
                    {/* Animated Bars */}
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-indigo-500/50" />
                                <div className="h-2 flex-1 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-1000 ease-in-out"
                                        style={{ width: `${60 + i * 10}%`, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                                    />
                                </div>
                                <div className="w-8 text-[10px] text-gray-500 text-right">%{(60 + i * 10)}</div>
                            </div>
                        ))}
                    </div>
                    {/* Floating Stats Card */}
                    <div className="absolute right-4 bottom-4 w-24 rounded-lg border border-white/10 bg-[#0F1014] p-2 shadow-lg animate-bounce">
                        <div className="text-[10px] text-gray-400">ROI Artışı</div>
                        <div className="text-base font-bold text-indigo-400">3.4x</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function BrandFeaturedShowcase() {
    return (
        <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-1 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full space-y-8 p-6 md:p-8 flex flex-col">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                        <Zap className="h-3 w-3" />
                        HIZLI ETKİLEŞİM
                    </div>
                    <h3 className="text-2xl font-bold text-white">Öne Çıkan İlanlar</h3>
                    <p className="text-sm text-gray-400">
                        Oluşturduğunuz kampanyalar vitrinde ve arama sonuçlarında en üstte listelenir, 3x daha fazla başvuru alın.
                    </p>
                </div>
                <div className="relative h-48 rounded-2xl bg-black/50 border border-white/5 p-4 flex flex-col justify-end gap-3 mt-auto overflow-hidden">
                    {/* Background lists */}
                    {[1, 2].map((i) => (
                        <div key={i} className="h-12 w-full rounded-lg bg-white/5 border border-white/5 opacity-30" />
                    ))}

                    {/* Hero Card Popping Up */}
                    <div className="absolute inset-x-4 bottom-4 h-14 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-900/20 border border-amber-500/50 flex items-center px-4 gap-3 z-10 shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-[bounce-in_3s_infinite]">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                        </div>
                        <div className="flex flex-col gap-1.5 has-[:last-child]:opacity-50">
                            <div className="h-2.5 w-24 rounded bg-amber-200/40" />
                            <div className="h-2 w-16 rounded bg-amber-200/20" />
                        </div>
                        <div className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-black animate-pulse">
                            ÖNE ÇIKAN
                        </div>
                    </div>

                    <style jsx>{`
                        @keyframes bounce-in {
                            0%, 100% { transform: translateY(0) scale(1); }
                            50% { transform: translateY(-5px) scale(1.02); box-shadow: 0 10px 40px rgba(245,158,11,0.3); }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    )
}
