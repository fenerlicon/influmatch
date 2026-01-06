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

    const handleSubscribe = async (tier: 'mbasic' | 'mpro') => {
        if (!userId) {
            toast.error('Oturum açmanız gerekiyor.')
            return
        }

        if (verificationStatus !== 'verified') {
            toast.error('Spotlight kullanabilmek için hesabınızın onaylanması gerekmektedir.')
            return
        }

        if (spotlightActive) {
            toast.error('Paket değişikliği yapmadan önce lütfen mevcut paketinizi iptal edin.')
            return
        }

        setProcessing(true)
        try {
            // In a real app, this would redirect to Stripe/Payment Gateway
            const result = await activateSpotlightPlan(userId, tier, billingInterval)

            if (result.success) {
                toast.success(`Brand ${tier === 'mbasic' ? 'Basic' : 'Pro'} paketine başarıyla geçiş yapıldı!`)
                setSpotlightActive(true)
                setSubscriptionTier(tier)
                router.refresh()
            } else {
                toast.error(result.error || 'Bir hata oluştu.')
            }
        } catch (error) {
            toast.error('İşlem başarısız oldu.')
        } finally {
            setProcessing(false)
        }
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
                    {/* Snow Effect */}
                    <div className="pointer-events-none absolute inset-0 -top-20 z-0 overflow-hidden">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-fall rounded-full bg-white opacity-70"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `-${Math.random() * 20}%`,
                                    width: `${Math.random() * 10 + 5}px`,
                                    height: `${Math.random() * 10 + 5}px`,
                                    animationDuration: `${Math.random() * 5 + 5}s`,
                                    animationDelay: `${Math.random() * 5}s`,
                                }}
                            />
                        ))}
                    </div>

                    <div className="relative z-10 inline-block">
                        <div className="absolute -top-7 -left-4 -rotate-[40deg] transform filter drop-shadow-md z-20 origin-bottom-right">
                            <svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 58.067 58.067" xmlSpace="preserve" className="h-8 w-8" fill="currentColor">
                                <g>
                                    <path style={{ fill: '#D10024' }} d="M48.24,19.988c-1.554-3.525-4.544-6.307-5.044-8.775c-0.875-4.309,0.73-8.196,0.617-8.498
                                        c-0.191-0.518-0.783-0.781-1.296-0.574c-0.082,0.033-6.521,2.586-11.666,10.158c-3.159,4.654-2.887,9.155-2.787,10.82
                                        c-3.79,0.669-6.372,2.39-7.917,5.26c-1.637,3.037-1.428,6.871-1.391,7.525l0.122,2.238h25.864l0.198-2.671
                                        C45.242,31.427,50.154,24.329,48.24,19.988z"/>
                                    <path style={{ fill: '#EEEEEE' }} d="M47.785,42.143H20.258l-0.125-2.288c-0.007-0.133-0.09-2.02,0.658-3.764h24.12
                                        c0.648,1.604,0.729,3.877,0.73,3.921L47.785,42.143z"/>
                                    <circle style={{ fill: '#EEEEEE' }} cx="34.033" cy="53.05" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="45.642" cy="40.009" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="38.751" cy="40.009" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="39.835" cy="53.05" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="31.859" cy="40.009" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="28.234" cy="53.05" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="24.968" cy="40.009" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="15.86" cy="45.396" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="22.613" cy="53.05" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="52.207" cy="45.396" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="45.642" cy="53.05" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="46.336" cy="46.577" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="39.444" cy="46.577" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="32.552" cy="46.577" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="25.66" cy="46.577" r="5.017" />
                                    <circle style={{ fill: '#EEEEEE' }} cx="18.769" cy="46.577" r="5.017" />
                                    <path style={{ fill: '#EEEEEE' }} d="M12.281,4.908c-0.211-1.92-1.967-3.292-3.918-3.057c-1.637,0.192-2.812,1.529-2.903,3.098
                                        l-0.082,1.383c-1.396,0.505-2.261,1.96-1.956,3.486c0.239,1.196,1.404,2.2,2.693,2.2l2.365,0.222
                                        c0.55-1.424,1.821-2.529,3.376-2.735l0.428-0.057L12.281,4.908z"/>
                                </g>
                            </svg>
                        </div>
                        <h2 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-white to-green-500 animate-pulse drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]">
                            YILBAŞI FIRSATLARI
                        </h2>
                    </div>
                    <p className="mt-4 text-xl font-medium text-red-200">
                        🎄 Yeni yıla özel tüm paketlerde <span className="font-extrabold text-white underline decoration-wavy decoration-red-500">%50 İNDİRİM!</span> 🎄
                    </p>

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
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'yr' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Yıllık <span className="ml-1 text-[10px] font-bold opacity-100 bg-white text-red-600 px-1 rounded-full">EKSTRA İNDİRİM</span>
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
                        buttonText={userRole === 'influencer' ? "Marka Hesabı Gerekli" : (verificationStatus !== 'verified' ? "Hesap Onayı Gerekli" : (loading ? "Yükleniyor..." : processing ? "İşleniyor..." : "Paketi Seç"))}
                        isCurrentPlan={spotlightActive && subscriptionTier === 'mbasic'}
                        disabled={userRole === 'influencer' || verificationStatus !== 'verified'}
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
                        buttonText={userRole === 'influencer' ? "Marka Hesabı Gerekli" : (verificationStatus !== 'verified' ? "Hesap Onayı Gerekli" : (loading ? "Yükleniyor..." : processing ? "İşleniyor..." : "Paketi Seç"))}
                        isUpgrade={spotlightActive && subscriptionTier === 'mbasic'}
                        isCurrentPlan={spotlightActive && subscriptionTier === 'mpro'}
                        disabled={userRole === 'influencer' || verificationStatus !== 'verified'}
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
                                        onClick={() => window.location.href = 'mailto:info@influmatch.net'}
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
