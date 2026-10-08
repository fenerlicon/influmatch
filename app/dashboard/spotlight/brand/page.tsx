'use client'

import { useState, useEffect } from 'react'
import { BadgeCheck, BrainCircuit, Search, Target } from 'lucide-react'
import PricingCard from '@/components/spotlight/PricingCard'
import SpotlightFeatureList from '@/components/spotlight/SpotlightFeatureList'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { checkSpotlightStatus, cancelSpotlightPlan } from '@/app/actions/spotlight'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { planFeatures, planPrice } from '@/lib/spotlight-plans'

const features = [
    {
        icon: BrainCircuit,
        title: 'Akıllı Eşleştirme',
        description: 'Sektörüne uygun, doğrulanmış influencerlar kategori uyumu, etkileşim ve doğrulama durumuna göre puanlanarak önerilir.',
    },
    {
        icon: BadgeCheck,
        title: 'Kampanya Uyum Skoru',
        description: 'Her önerilen profil için 100 üzerinden eşleşme skorunu ve nedenlerini gör.',
    },
    {
        icon: Search,
        title: 'Benzer Profil Keşfi',
        description: 'Beğendiğin bir profile benzer diğer influencerları tek tıkla listele.',
    },
    {
        icon: Target,
        title: 'Öne Çıkan İlanlar',
        description: 'İlanların influencerların gördüğü topluluk listesinde üst sıralarda yer alır.',
    },
]

export default function BrandSpotlightPage() {
    const router = useRouter()
    const [billingInterval, setBillingInterval] = useState<'mo' | 'yr'>('mo')
    const [, setLoading] = useState(true)
    const [, setProcessing] = useState(false)
    const [spotlightActive, setSpotlightActive] = useState(false)
    const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [, setUserRole] = useState<string | null>(null)
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
                        Doğru influencer'la nokta atışı eşleşmek ve kampanyalarını veriye dayalı yönetmek için akıllı eşleştirmeyi kullan.
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
                    <h2 className="text-xl font-semibold text-white">Akıllı Eşleştirme Avantajları</h2>
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
                        price={planPrice('mbasic', billingInterval).price}
                                                interval={billingInterval}
                        features={planFeatures('mbasic')}
                        variant="brand"
                        buttonText="Satın Alma Kapalı — Yakında"
                        isCurrentPlan={spotlightActive && subscriptionTier === 'mbasic'}
                        disabled={true}
                        onSelect={() => handleSubscribe('mbasic')}
                        onCancel={handleCancel}
                    />

                    <PricingCard
                        title="Brand Pro"
                        price={planPrice('mpro', billingInterval).price}
                                                interval={billingInterval}
                        features={planFeatures('mpro')}
                        recommended
                        variant="brand"
                        buttonText="Satın Alma Kapalı — Yakında"
                        isUpgrade={spotlightActive && subscriptionTier === 'mbasic'}
                        isCurrentPlan={spotlightActive && subscriptionTier === 'mpro'}
                        disabled={true}
                        onSelect={() => handleSubscribe('mpro')}
                        onCancel={handleCancel}
                    />

                </div>
            </section>
        </div>
    )
}
