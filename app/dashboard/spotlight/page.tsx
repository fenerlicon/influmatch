import { BadgeDollarSign, Building2, Crown, Sparkles, Users } from 'lucide-react'
import SpotlightSelectionCard from '@/components/spotlight/SpotlightSelectionCard'
import SpotlightShowcase from '@/components/spotlight/SpotlightShowcase'

export const metadata = {
    title: 'Spotlight | Influmatch',
    description: 'Markalar ve Influencerlar için premium özellikler.',
}

export default function SpotlightSelectionPage() {
    return (
        <div className="min-h-[80vh] space-y-12 py-10">
            <header className="mx-auto max-w-3xl text-center">
                <div className="mb-6 inline-flex items-center justify-center rounded-full border border-soft-gold/30 bg-soft-gold/10 px-4 py-1.5 backdrop-blur-sm">
                    <Sparkles className="mr-2 h-4 w-4 text-soft-gold" />
                    <span className="text-xs font-bold uppercase tracking-widest text-soft-gold">Premium Experience</span>
                </div>
                <h1 className="text-4xl font-bold text-white md:text-6xl lg:text-7xl">
                    Spotlight <span className="text-soft-gold">Editions</span>
                </h1>
                <p className="mt-6 text-lg text-gray-400 md:text-xl">
                    Hedefine uygun Spotlight paketini seç, platformun tüm gücünü açığa çıkar.
                </p>
            </header>

            <div className="grid gap-6 px-4 md:grid-cols-3 lg:gap-8">
                <SpotlightSelectionCard
                    title="Influencer Edition"
                    description="Keşfedilme gücünü artır, markaların radarına daha sık gir. Vitrin rozeti, öncelikli listeleme ve daha fazlası."
                    icon={Crown}
                    href="/dashboard/spotlight/influencer"
                    variant="influencer"
                    isComingSoon
                />

                <SpotlightSelectionCard
                    title="Brand Edition"
                    description="Doğru influencer'la eşleşmek için kişiselleştirilmiş zeka. AI eşleşme, detaylı filtreler ve kampanya yönetimi."
                    icon={BadgeDollarSign}
                    href="/dashboard/spotlight/brand"
                    variant="brand"
                />

                <SpotlightSelectionCard
                    title="Agency Edition"
                    description="Ajanslar için gelişmiş ağ yönetimi, çoklu marka yönetimi ve otomatik casting altyapısı."
                    icon={Building2}
                    href="/dashboard/spotlight/agency"
                    variant="agency"
                    isComingSoon
                />
            </div>

            <SpotlightShowcase />
        </div>
    )
}
