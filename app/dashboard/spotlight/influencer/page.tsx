'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Crown, Search, Users } from 'lucide-react'
import PricingCard from '@/components/spotlight/PricingCard'
import SpotlightFeatureList from '@/components/spotlight/SpotlightFeatureList'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { checkSpotlightStatus, cancelSpotlightPlan } from '@/app/actions/spotlight'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { planFeatures, planPrice } from '@/lib/spotlight-plans'

const features = [
    {
        icon: Crown,
        title: 'Spotlight Rozeti',
        description: 'Profilinde ve kartında Spotlight rozeti ve çerçevesiyle markaların dikkatini çek.',
    },
    {
        icon: Search,
        title: 'Öncelikli Listeleme',
        description: 'Markalar keşfette influencer ararken Spotlight profilleri listenin üst sıralarında yer alır.',
    },
    {
        icon: Users,
        title: 'Profil Görüntülenmeleri',
        description: 'Profilini kaç markanın görüntülediğini panelinden takip et.',
    },
    {
        icon: BarChart3,
        title: 'Detaylı Profil Analizi',
        description: 'İstatistiklerinden uyum skoru ve (Pro) profil koçu yorumları al.',
    },
]

export default function InfluencerSpotlightPage() {
    const router = useRouter()
    const [billingInterval, setBillingInterval] = useState<'mo' | 'yr'>('mo')
    const [, setLoading] = useState(true)
    const [, setProcessing] = useState(false)
    const [spotlightActive, setSpotlightActive] = useState(false)
    const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null)

    useEffect(() => {
        const checkStatus = async () => {
            const supabase = createSupabaseBrowserClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUserId(session.user.id)

                // Check server status first to handle expirations
                try {
                    await checkSpotlightStatus(session.user.id)
                } catch (e) {
                    console.error('Spotlight check failed', e)
                }

                const { data } = await supabase
                    .from('users')
                    .select('role, spotlight_active, spotlight_plan, spotlight_expires_at, verification_status')
                    .eq('id', session.user.id)
                    .single()

                if (data) {
                    setUserRole(data.role) // rol DB'den; user_metadata güvenilmez
                    setVerificationStatus(data.verification_status)
                    setSpotlightActive(!!data.spotlight_active)
                    if (data.spotlight_active) {
                        setSubscriptionTier(data.spotlight_plan || 'ibasic')
                    }
                }
            }
            setLoading(false)
        }
        checkStatus()
    }, [])

    const handleCancel = async () => {
        if (!userId) return
        if (!confirm('Spotlight üyeliğinizi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return

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
            <header className="relative overflow-hidden rounded-[32px] border border-soft-gold/20 bg-[#151621] p-8 text-center shadow-[0_0_40px_-10px_rgba(212,175,55,0.3)] sm:p-16">
                <div className="relative z-10 mx-auto max-w-3xl">
                    <div className="mb-6 inline-flex items-center justify-center rounded-full border border-soft-gold/30 bg-soft-gold/10 px-4 py-1.5">
                        <Crown className="mr-2 h-4 w-4 text-soft-gold" />
                        <span className="text-xs font-bold uppercase tracking-widest text-soft-gold">Influencer Edition</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                        Yıldızın <span className="text-soft-gold">Sahnede</span>
                    </h1>
                    <p className="mt-6 text-lg text-gray-400">
                        Markaların seni keşfetmesini bekleme. Spotlight ile öne çık, iş birliklerini kendin yönet.
                    </p>
                </div>

                {/* Background Gradients */}
                <div className="absolute top-0 right-1/4 h-[500px] w-[500px] translate-x-1/2 -translate-y-1/2 rounded-full bg-soft-gold/5 blur-[100px]" />
                <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] -translate-x-1/2 translate-y-1/2 rounded-full bg-yellow-500/5 blur-[100px]" />
            </header>

            {/* Features */}
            <section>
                <div className="mb-8 flex items-center gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                    <h2 className="text-xl font-semibold text-white">Influencer Avantajları</h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                </div>
                <SpotlightFeatureList features={features} variant="influencer" />
            </section>

            {/* Pricing */}
            <section className="mx-auto max-w-5xl">
                <div className="mb-12 text-center relative">
                    <div className="relative z-10 inline-block">
                        <h2 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-soft-gold via-white to-soft-gold drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                            SPOTLIGHT FIRSATLARI
                        </h2>
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
                            className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${billingInterval === 'yr' ? 'bg-soft-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.5)]' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Yıllık
                        </button>
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:gap-16 pt-8">
                    <PricingCard
                        title="Spotlight Basic"
                        price={planPrice('ibasic', billingInterval).price}
                                                interval={billingInterval}
                        features={planFeatures('ibasic')}
                        variant="influencer"
                        buttonText={userRole === 'brand' ? "Influencer Hesabı Gerekli" : "Yakında / İletişime Geç"}
                        isCurrentPlan={spotlightActive && subscriptionTier === 'ibasic'}
                        disabled={true}
                        onSelect={() => window.location.href = 'mailto:destek@influmatch.net'}
                        onCancel={handleCancel}
                    />

                    <PricingCard
                        title="Spotlight Pro"
                        price={planPrice('ipro', billingInterval).price}
                                                interval={billingInterval}
                        features={planFeatures('ipro')}
                        recommended
                        variant="influencer"
                        buttonText={userRole === 'brand' ? "Influencer Hesabı Gerekli" : "Yakında / İletişime Geç"}
                        isUpgrade={spotlightActive && subscriptionTier === 'ibasic'}
                        isCurrentPlan={spotlightActive && subscriptionTier === 'ipro'}
                        disabled={true}
                        onSelect={() => window.location.href = 'mailto:destek@influmatch.net'}
                        onCancel={handleCancel}
                    />

                </div>
            </section>
        </div>
    )
}
