'use client'

import { useState } from 'react'
import { BadgeCheck, BarChart3, Bot, BrainCircuit, HeartHandshake, Search, Target, Users } from 'lucide-react'
import PricingCard from '@/components/spotlight/PricingCard'
import SpotlightFeatureList from '@/components/spotlight/SpotlightFeatureList'

const features = [
    {
        icon: BrainCircuit,
        title: 'AI Influencer Eşleşmesi',
        description: 'Markanın kriterlerine, bütçesine ve tarzına en uygun influencerları yapay zeka ile bul.',
    },
    {
        icon: Target,
        title: 'Akıllı Filtreler',
        description: 'Anti-bot skor, etkileşim oranı, görsel kalite ve post sıklığına göre detaylı filtreleme yap.',
    },
    {
        icon: BadgeCheck,
        title: 'Kampanya Uyumluluk Skoru',
        description: 'Her influencer için kampanya hedeflerinle ne kadar uyumlu olduğunu gösteren % skorunu gör.',
    },
    {
        icon: HeartHandshake,
        title: 'Brief Önceliği',
        description: 'Spotlight influencerlarına gönderdiğin teklifler "Premium Marka" etiketiyle öne çıkar, hızlı yanıt alırsın.',
    },
    {
        icon: Search,
        title: 'Look-alike Keşfi',
        description: 'Beğendiğin bir profile benzer özelliklere sahip diğer gizli yetenekleri otomatik keşfet.',
    },
    {
        icon: Bot,
        title: 'Anti-Bot & Sentiment Analizi',
        description: 'Takipçi kitlesinin organiklik durumunu ve içeriklerin güven puanını AI ile analiz et.',
    },
]



export default function BrandSpotlightPage() {
    const [billingInterval, setBillingInterval] = useState<'mo' | 'yr'>('yr')

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <header className="relative overflow-hidden rounded-[32px] border border-blue-500/20 bg-[#151621] p-8 text-center shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)] sm:p-16">
                <div className="relative z-10 mx-auto max-w-3xl">
                    <div className="mb-6 inline-flex items-center justify-center rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-1.5">
                        <BrainCircuit className="mr-2 h-4 w-4 text-blue-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Brand Edition</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                        Kişiselleştirilmiş <span className="text-blue-400">Zeka</span>
                    </h1>
                    <p className="mt-6 text-lg text-gray-400">
                        Doğru influencer'la nokta atışı eşleşmek ve kampanyalarını veriye dayalı yönetmek için AI gücünü kullan.
                    </p>
                </div>

                {/* Background Gradients */}
                <div className="absolute top-0 right-1/4 h-[500px] w-[500px] translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-[100px]" />
                <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] -translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-500/5 blur-[100px]" />
            </header>

            {/* Features */}
            <section>
                <div className="mb-8 flex items-center gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                    <h2 className="text-xl font-semibold text-white">AI Match Avantajları</h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                </div>
                <SpotlightFeatureList features={features} variant="brand" />
            </section>

            {/* Pricing */}
            <section className="mx-auto max-w-5xl">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold text-white">Markanız İçin Akıllı Yatırım</h2>
                    <p className="mt-4 text-gray-400">Yıllık planda cast yönetimi ve ekip özellikleri ücretsiz.</p>

                    {/* Billing Toggle */}
                    <div className="mt-8 inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
                        <button
                            onClick={() => setBillingInterval('mo')}
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'mo' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Aylık
                        </button>
                        <button
                            onClick={() => setBillingInterval('yr')}
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'yr' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Yıllık <span className="ml-1 text-[10px] font-bold opacity-80">-20%</span>
                        </button>
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
                    <PricingCard
                        title="Business Aylık"
                        price="999 ₺"
                        interval="mo"
                        features={[
                            { text: "Sınırsız AI Eşleşme", highlight: true },
                            { text: "Anti-Bot Analizleri" },
                            { text: "Gelişmiş Filtreleme" },
                            { text: "Tek Kullanıcı" },
                        ]}
                        variant="brand"
                        buttonText="Yükselt"
                    />

                    <PricingCard
                        title="Business Yıllık"
                        price={billingInterval === 'mo' ? "799 ₺" : "9999 ₺"}
                        interval={billingInterval === 'mo' ? 'mo' : 'yr'}
                        features={[
                            { text: "Tüm Business Özellikleri", highlight: true },
                            { text: "Cast & Favori Havuzu Yönetimi", highlight: true },
                            { text: "Ekip Erişimi (3 Kişi)" },
                            { text: "Brief Önceliklendirme" },
                        ]}
                        recommended
                        variant="brand"
                        buttonText="Avantajlı Başla"
                    />
                </div>
            </section>
        </div>
    )
}
