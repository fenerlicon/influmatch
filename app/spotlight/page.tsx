'use client'

import { useState } from 'react'
import { BrainCircuit, Crown, Sparkles } from 'lucide-react'
import Link from 'next/link'
import PricingCard from '@/components/spotlight/PricingCard'
import { useRouter } from 'next/navigation'
import { planFeatures, planPrice } from '@/lib/spotlight-plans'

export default function PublicSpotlightPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'brand' | 'influencer'>('brand')
    const [billingInterval, setBillingInterval] = useState<'mo' | 'yr'>('mo')

    // Since this is a public page, we always direct to signup/login or dashboard if already logged in (checked by middleware usually)
    // But for this specific request, we simplify and just show "Kayıt Ol & Başla" for everyone
    const handleAction = (role: 'brand' | 'influencer') => {
        router.push(`/signup-role?role=${role}`)
    }

    return (
        <main className="min-h-screen bg-[#0B0C10] text-white">
            {/* Nav (Simple) */}
            <nav className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-6 md:px-12 lg:px-24">
                <Link href="/" className="text-2xl font-bold tracking-tighter text-white">
                    INFLU<span className="text-soft-gold">MATCH</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white">Giriş Yap</Link>
                    <Link href="/signup-role" className="rounded-full bg-soft-gold px-5 py-2 text-sm font-bold text-[#0B0C10] transition hover:bg-white hover:text-black">Kayıt Ol</Link>
                </div>
            </nav>

            <div className="relative pt-32 pb-20 px-6 md:px-12 lg:px-24">
                {/* Background Effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-900/20 via-purple-900/10 to-transparent blur-3xl -z-10" />

                {/* Hero */}
                <div className="text-center max-w-4xl mx-auto mb-16">
                    <div className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-6 backdrop-blur">
                        <Sparkles className="mr-2 h-4 w-4 text-soft-gold" />
                        <span className="text-xs font-bold uppercase tracking-widest text-soft-gold">PREMIUM DENEYİM</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
                        Potansiyelini <span className="text-transparent bg-clip-text bg-gradient-to-r from-soft-gold to-yellow-200">Keşfet</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        İster marka ol, ister influencer. Spotlight paketleri ile akıllı eşleştirme ve detaylı analiz özelliklerini kullan, rakiplerinin önüne geç.
                    </p>

                    {/* Toggle */}
                    <div className="mt-10 inline-flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
                        <button
                            onClick={() => setActiveTab('brand')}
                            className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold transition-all ${activeTab === 'brand'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <BrainCircuit className="h-4 w-4" />
                            Markalar İçin
                        </button>
                        <button
                            onClick={() => setActiveTab('influencer')}
                            className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold transition-all ${activeTab === 'influencer'
                                ? 'bg-soft-gold text-black shadow-lg shadow-yellow-500/30'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Crown className="h-4 w-4" />
                            Influencerlar İçin
                        </button>
                    </div>
                </div>

                {/* Billing Toggle */}
                <div className="flex justify-center mb-12">
                    <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
                        <button
                            onClick={() => setBillingInterval('mo')}
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'mo' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Aylık
                        </button>
                        <button
                            onClick={() => setBillingInterval('yr')}
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'yr' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Yıllık
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-6xl mx-auto">
                    {activeTab === 'brand' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid gap-8 md:grid-cols-2 lg:gap-16">
                                <PricingCard
                                    title="Brand Basic"
                                    price={planPrice('mbasic', billingInterval).price}
                                    interval={billingInterval}
                                    features={planFeatures('mbasic')}
                                    variant="brand"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('brand')}
                                />
                                <PricingCard
                                    title="Brand Pro"
                                    price={planPrice('mpro', billingInterval).price}
                                    interval={billingInterval}
                                    features={planFeatures('mpro')}
                                    recommended
                                    variant="brand"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('brand')}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid gap-8 md:grid-cols-2 lg:gap-16">
                                <PricingCard
                                    title="Spotlight Basic"
                                    price={planPrice('ibasic', billingInterval).price}
                                    interval={billingInterval}
                                    features={planFeatures('ibasic')}
                                    variant="influencer"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('influencer')}
                                />
                                <PricingCard
                                    title="Spotlight Pro"
                                    price={planPrice('ipro', billingInterval).price}
                                    interval={billingInterval}
                                    features={planFeatures('ipro')}
                                    recommended
                                    variant="influencer"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('influencer')}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
