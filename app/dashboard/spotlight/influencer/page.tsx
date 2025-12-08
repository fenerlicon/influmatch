'use client'

import { useState } from 'react'
import { Crown, Eye, LineChart, Megaphone, MousePointerClick, Zap } from 'lucide-react'
import PricingCard from '@/components/spotlight/PricingCard'
import SpotlightFeatureList from '@/components/spotlight/SpotlightFeatureList'

const features = [
    {
        icon: Eye,
        title: 'Markaların Favorisi Ol',
        description: 'Seni favoriye ekleyen markaların öneri akışlarında en üst sıralarda görünürsün.',
    },
    {
        icon: Crown,
        title: 'Premium Profil Rozeti',
        description: 'Profil fotoğrafının çevresinde parlayan altın çerçeve ve verified rozeti ile güven ver.',
    },
    {
        icon: Zap,
        title: 'Algoritmada Öne Çık',
        description: 'Marka öneri sisteminde artırılmış ağırlık katsayısıyla rakiplerinin önüne geç.',
    },
    {
        icon: MousePointerClick,
        title: 'Aramalarda İlk Sırada',
        description: 'Kategori, şehir ve niche filtrelerinde Spotlight üyeleri her zaman önce listelenir.',
    },
    {
        icon: Megaphone,
        title: 'Öncelikli Bildirimler',
        description: 'Markalar yeni kampanya veya casting açtığında bildirimi ilk sen alırsın.',
    },
    {
        icon: LineChart,
        title: 'Gelişmiş Analitikler',
        description: 'Detaylı etkileşim grafikleri, rakip karşılaştırma ve trend analizlerine erişim sağla.',
    },
]

export default function InfluencerSpotlightPage() {
    const [billingInterval, setBillingInterval] = useState<'mo' | 'yr'>('yr')

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <header className="relative overflow-hidden rounded-[32px] border border-soft-gold/20 bg-[#151621] p-8 text-center shadow-glow sm:p-16">
                <div className="relative z-10 mx-auto max-w-3xl">
                    <div className="mb-6 inline-flex items-center justify-center rounded-full border border-soft-gold/30 bg-soft-gold/10 px-4 py-1.5">
                        <Crown className="mr-2 h-4 w-4 text-soft-gold" />
                        <span className="text-xs font-bold uppercase tracking-widest text-soft-gold">Influencer Edition</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                        Keşfedilme Gücünü <span className="text-soft-gold">Artır</span>
                    </h1>
                    <p className="mt-6 text-lg text-gray-400">
                        Markaların radarına daha sık gir, prestijli rozetlerle öne çık ve potansiyelini maksimuma çıkar.
                    </p>
                </div>

                {/* Background Gradients */}
                <div className="absolute top-0 left-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-soft-gold/5 blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-purple-500/5 blur-[100px]" />
            </header>

            {/* Features */}
            <section>
                <div className="mb-8 flex items-center gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                    <h2 className="text-xl font-semibold text-white">Spotlight Avantajları</h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                </div>
                <SpotlightFeatureList features={features} variant="influencer" />
            </section>

            {/* Pricing */}
            <section className="mx-auto max-w-5xl">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold text-white">Senin İçin En Uygun Planı Seç</h2>
                    <p className="mt-4 text-gray-400">Yıllık planda 2 ay bedava ve ekstra avantajlar senin olsun.</p>

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
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'yr' ? 'bg-soft-gold text-black shadow-sm' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Yıllık <span className="ml-1 text-[10px] font-bold opacity-80">-20%</span>
                        </button>
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
                    <PricingCard
                        title="Aylık Paket"
                        price="299 ₺"
                        interval="mo"
                        features={[
                            { text: "Tüm Spotlight özellikleri", highlight: true },
                            { text: "Vitrin rozeti ve çerçeve" },
                            { text: "Öncelikli listeleme" },
                            { text: "İstediğin zaman iptal et" },
                        ]}
                        variant="influencer"
                        buttonText="Hemen Başla"
                    />

                    <PricingCard
                        title="Yıllık Paket"
                        price={billingInterval === 'mo' ? "249 ₺" : "2999 ₺"}
                        interval={billingInterval === 'mo' ? 'mo' : 'yr'}
                        features={[
                            { text: "Aylık paketteki her şey", highlight: true },
                            { text: "2 ay ücretsiz kullanım", highlight: true },
                            { text: "+30 gün ekstra Badge süresi" },
                            { text: "Analytics Boost hediye" },
                        ]}
                        recommended
                        variant="influencer"
                        buttonText="Yıllık Avantajla Başla"
                    />
                </div>
            </section>
        </div>
    )
}
