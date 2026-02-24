'use client'

import { useState, useEffect } from 'react'
import { BadgeCheck, BarChart3, Bot, BrainCircuit, HeartHandshake, Search, Target, Users } from 'lucide-react'
import PricingCard from '@/components/spotlight/PricingCard'
import SpotlightFeatureList from '@/components/spotlight/SpotlightFeatureList'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { activateSpotlightPlan, checkSpotlightStatus, cancelSpotlightPlan } from '@/app/actions/spotlight'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
    const router = useRouter()
    const [billingInterval, setBillingInterval] = useState<'mo' | 'yr'>('mo')
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [spotlightActive, setSpotlightActive] = useState(false)
    const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null)

    useEffect(() => {
        const checkStatus = async () => {
            const supabase = createSupabaseBrowserClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUserRole(session.user.user_metadata?.role)
                setUserId(session.user.id)

                // Check server status first to handle expirations
                try {
                    await checkSpotlightStatus(session.user.id)
                } catch (e) {
                    console.error('Spotlight check failed', e)
                }

                const { data } = await supabase
                    .from('users')
                    .select('spotlight_active, spotlight_plan, spotlight_expires_at, verification_status')
                    .eq('id', session.user.id)
                    .single()

                if (data) {
                    setVerificationStatus(data.verification_status)
                    setSpotlightActive(!!data.spotlight_active)
                    if (data.spotlight_active) {
                        setSubscriptionTier(data.spotlight_plan || 'mbasic')
                    }
                }
            }
            setLoading(false)
        }
        checkStatus()
    }, [])

    const handleSubscribe = async (_tier: 'mbasic' | 'mpro') => {
        toast.info('Ödeme sistemi hazırlanıyor.', {
            description: 'Spotlight satın alma özelliği yakında aktif olacak. Bilgilendirme için destek@influmatch.net adresine yazabilirsiniz.',
            duration: 6000,
        })
    }

    const handleCancel = async () => {
        if (!userId) return
        if (!confirm('Spotlight üyeliğinizi iptal etmek istediğinize emin misiniz?')) return

        setProcessing(true)
        try {
            const result = await cancelSpotlightPlan(userId)
            if (result.success) {
                toast.success('Üyeliğiniz iptal edildi.')
                setSpotlightActive(false)
                setSubscriptionTier(null)
                router.refresh()
            } else {
                toast.error(result.error || 'İptal işlemi başarısız.')
            }
        } catch (error) {
            toast.error('İşlem sırasında hata oluştu.')
        } finally {
            setProcessing(false)
        }
    }

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
                <div className="mb-12 text-center relative">
                    <div className="relative z-10">
                        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold mb-2">Fiyatlandırma</p>
                        <h2 className="text-3xl font-bold text-white">Paketler</h2>
                        <p className="mt-3 text-sm text-gray-400 max-w-md mx-auto">
                            Ödeme sistemi yakında aktif olacak. Şu an satın alma işlemi gerçekleştirilememektedir.
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-medium text-yellow-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                            Satın Alma Yakında Açılıyor
                        </div>
                    </div>

                    {/* Billing Toggle */}
                    <div className="mt-8 inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
                        <button
                            onClick={() => setBillingInterval('mo')}
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'mo' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Aylık
                        </button>
                        <button
                            onClick={() => setBillingInterval('yr')}
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'yr' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Yıllık
                        </button>
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:gap-16 pt-8">
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
                        buttonText="Satın Alma Kapalı — Yakında"
                        isCurrentPlan={spotlightActive && subscriptionTier === 'mbasic'}
                        disabled={true}
                        onSelect={() => handleSubscribe('mbasic')}
                        onCancel={handleCancel}
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
                        buttonText="Satın Alma Kapalı — Yakında"
                        isUpgrade={spotlightActive && subscriptionTier === 'mbasic'}
                        isCurrentPlan={spotlightActive && subscriptionTier === 'mpro'}
                        disabled={true}
                        onSelect={() => handleSubscribe('mpro')}
                        onCancel={handleCancel}
                    />

                    {/* Agency Edition Card - Full Width on Mobile, Spans 2 cols on large if needed, but here just listed */}
                    <div className="md:col-span-2 lg:col-span-2">
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
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <BadgeCheck className="h-5 w-5 text-purple-500" />
                                            <span>Çoklu Kullanıcı Yönetimi & Yetkilendirme</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <BadgeCheck className="h-5 w-5 text-purple-500" />
                                            <span>White-Label Raporlama</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <BadgeCheck className="h-5 w-5 text-purple-500" />
                                            <span>Özel API Erişimi & Entegrasyonlar</span>
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
                                    <button
                                        onClick={() => window.location.href = 'mailto:destek@influmatch.net'}
                                        className="rounded-xl bg-purple-600 px-8 py-4 font-bold text-white transition-all hover:bg-purple-700 hover:scale-105 active:scale-95"
                                    >
                                        Bizimle İletişime Geçin
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
