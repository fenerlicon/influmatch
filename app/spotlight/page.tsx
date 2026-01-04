'use client'

import { useState } from 'react'
import { BadgeCheck, BrainCircuit, Crown, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'
import PricingCard from '@/components/spotlight/PricingCard'
import { useRouter } from 'next/navigation'

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
                        İster marka ol, ister influencer. Spotlight paketleri ile yapay zeka destekli özellikleri kullan, rakiplerinin önüne geç.
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
                            Yıllık <span className="ml-1 text-[10px] font-bold opacity-100 bg-white text-red-600 px-1 rounded-full">EKSTRA İNDİRİM</span>
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
                                    price={billingInterval === 'mo' ? "750 ₺" : "7.500 ₺"}
                                    originalPrice={billingInterval === 'mo' ? "1.500 ₺" : "15.000 ₺"}
                                    interval={billingInterval}
                                    features={[
                                        { text: "Sınırsız AI Eşleşme", highlight: true },
                                        { text: "Anti-Bot Analizleri" },
                                        { text: "Temel Filtreleme" },
                                    ]}
                                    variant="brand"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('brand')}
                                />
                                <PricingCard
                                    title="Brand Pro"
                                    price={billingInterval === 'mo' ? "1.250 ₺" : "12.500 ₺"}
                                    originalPrice={billingInterval === 'mo' ? "2.500 ₺" : "25.000 ₺"}
                                    interval={billingInterval}
                                    features={[
                                        { text: "Sınırsız AI Eşleşme", highlight: true },
                                        { text: "Detaylı Profil Analizi & İçgörü", highlight: true },
                                        { text: "Gelişmiş Filtreleme & Look-alike", highlight: true },
                                        { text: "Brief Önceliklendirme (Premium)", highlight: true },
                                        { text: "Favori Listeleri ve Klasörleme" },
                                    ]}
                                    recommended
                                    variant="brand"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('brand')}
                                />
                            </div>
                            {/* Agency Edition Card */}
                            <div className="mt-12">
                                <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-[#1A1B26] p-8 shadow-[0_0_40px_-10px_rgba(168,85,247,0.2)] transition-all hover:border-purple-500/50 hover:shadow-[0_0_60px_-15px_rgba(168,85,247,0.3)]">
                                    <div className="absolute top-0 right-0 rounded-bl-3xl bg-purple-600 px-6 py-2 text-sm font-bold text-white shadow-lg">
                                        KURUMSAL
                                    </div>

                                    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-purple-500/20 p-3 text-purple-400">
                                                    <Users className="h-8 w-8" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-bold text-white">Agency Edition</h3>
                                                    <p className="text-purple-300">Büyük ölçekli ekipler ve ajanslar için</p>
                                                </div>
                                            </div>
                                            <div className="md:flex md:gap-8 space-y-2 md:space-y-0">
                                                <div className="flex items-center gap-2 text-gray-300">
                                                    <BadgeCheck className="h-5 w-5 text-purple-500" />
                                                    <span>Çoklu Kullanıcı Yönetimi</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-300">
                                                    <BadgeCheck className="h-5 w-5 text-purple-500" />
                                                    <span>White-Label Raporlama</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-300">
                                                    <BadgeCheck className="h-5 w-5 text-purple-500" />
                                                    <span>Özel Entegrasyonlar</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-start gap-4 lg:items-end">
                                            <div className="text-left lg:text-right">
                                                <p className="text-sm text-gray-400">Size özel çözümler için</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-bold text-white">Teklif Alın</span>
                                                </div>
                                            </div>
                                            <Link href="mailto:info@influmatch.net" className="rounded-xl bg-purple-600 px-8 py-4 font-bold text-white transition-all hover:bg-purple-700 hover:scale-105 active:scale-95">
                                                İletişime Geçin
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid gap-8 md:grid-cols-2 lg:gap-16">
                                <PricingCard
                                    title="Spotlight Basic"
                                    price={billingInterval === 'mo' ? "99 ₺" : "990 ₺"}
                                    originalPrice={billingInterval === 'mo' ? "198 ₺" : "1.980 ₺"}
                                    interval={billingInterval}
                                    features={[
                                        { text: "Vitrin Rozeti", highlight: true },
                                        { text: "Öncelikli Listeleme" },
                                        { text: "Temel Profil Analizi" },
                                    ]}
                                    variant="influencer"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('influencer')}
                                />
                                <PricingCard
                                    title="Spotlight Pro"
                                    price={billingInterval === 'mo' ? "199 ₺" : "1.990 ₺"}
                                    originalPrice={billingInterval === 'mo' ? "398 ₺" : "3.980 ₺"}
                                    interval={billingInterval}
                                    features={[
                                        { text: "Vitrin Rozeti", highlight: true },
                                        { text: "En Üst Sırada Listeleme", highlight: true },
                                        { text: "Hızlı Eşleşme Önceliği (Premium)", highlight: true },
                                        { text: "Detaylı Profil Analizi & İçgörü", highlight: true },
                                        { text: "AI İçerik Asistanı" },
                                    ]}
                                    recommended
                                    variant="influencer"
                                    buttonText="Kayıt Ol & Başla"
                                    onSelect={() => handleAction('influencer')}
                                />
                            </div>
                            {/* Agency Edition Card Influencer Side (Talent Management) */}
                            <div className="mt-12">
                                <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-[#1A1B26] p-8 shadow-[0_0_40px_-10px_rgba(168,85,247,0.2)] transition-all hover:border-purple-500/50 hover:shadow-[0_0_60px_-15px_rgba(168,85,247,0.3)]">
                                    <div className="absolute top-0 right-0 rounded-bl-3xl bg-purple-600 px-6 py-2 text-sm font-bold text-white shadow-lg">
                                        KURUMSAL
                                    </div>

                                    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-purple-500/20 p-3 text-purple-400">
                                                    <Users className="h-8 w-8" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-bold text-white">Agency Edition</h3>
                                                    <p className="text-purple-300">Talent management ajansları için</p>
                                                </div>
                                            </div>
                                            <div className="md:flex md:gap-8 space-y-2 md:space-y-0">
                                                <div className="flex items-center gap-2 text-gray-300">
                                                    <BadgeCheck className="h-5 w-5 text-purple-500" />
                                                    <span>Sınırsız Talent Yönetimi</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-300">
                                                    <BadgeCheck className="h-5 w-5 text-purple-500" />
                                                    <span>Toplu Başvuru Gönderimi</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-300">
                                                    <BadgeCheck className="h-5 w-5 text-purple-500" />
                                                    <span>Ajans Vitrini</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-start gap-4 lg:items-end">
                                            <div className="text-left lg:text-right">
                                                <p className="text-sm text-gray-400">Ajanslar için özel çözümler</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-bold text-white">Teklif Alın</span>
                                                </div>
                                            </div>
                                            <Link href="mailto:info@influmatch.net" className="rounded-xl bg-purple-600 px-8 py-4 font-bold text-white transition-all hover:bg-purple-700 hover:scale-105 active:scale-95">
                                                Ajans Başvurusu
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
