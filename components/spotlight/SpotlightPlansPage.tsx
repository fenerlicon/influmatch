'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BadgeCheck, BellRing, BrainCircuit, Crown, Search, Target, Users } from 'lucide-react'
import PricingCard from '@/components/spotlight/PricingCard'
import SpotlightFeatureList, { type SpotlightFeature } from '@/components/spotlight/SpotlightFeatureList'
import { ConfirmDialog, Notice, PageHeader, Segmented } from '@/components/ui'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { checkSpotlightStatus, cancelSpotlightPlan } from '@/app/actions/spotlight'
import { planFeatures, planPrice, type BillingInterval, type SpotlightPlanCode } from '@/lib/spotlight-plans'

type Role = 'influencer' | 'brand'

const FEATURES: Record<Role, SpotlightFeature[]> = {
  influencer: [
    { icon: Crown, title: 'Spotlight rozeti', description: 'Profilinde ve kartında Spotlight rozeti ve çerçevesiyle markaların dikkatini çek.' },
    { icon: Search, title: 'Öncelikli listeleme', description: 'Markalar keşifte influencer ararken Spotlight profilleri listenin üst sıralarında yer alır.' },
    { icon: Users, title: 'Profil görüntülenmeleri', description: 'Profilini kaç markanın görüntülediğini panelinden takip et.' },
    { icon: BellRing, title: 'Anlık ilan alarmı', description: 'Kurduğun alarma uyan ilan yayınlandığı anda bildirim alırsın (ücretsiz hesapta saatte bir kontrol edilir).' },
  ],
  brand: [
    { icon: BrainCircuit, title: 'Akıllı eşleştirme', description: 'Sektörüne uygun, doğrulanmış influencerlar kategori uyumu, etkileşim ve doğrulama durumuna göre puanlanarak önerilir.' },
    { icon: BadgeCheck, title: 'Uyum skoru', description: 'Her önerilen profil için 100 üzerinden eşleşme skorunu ve nedenlerini gör.' },
    { icon: Search, title: 'Benzer profil keşfi', description: 'Beğendiğin bir profile benzer diğer influencerları tek tıkla listele.' },
    { icon: Target, title: 'Öne çıkan ilanlar', description: 'İlanların influencerların gördüğü listede üst sıralarda yer alır.' },
  ],
}

const COPY: Record<Role, { description: string; plans: [SpotlightPlanCode, SpotlightPlanCode] }> = {
  influencer: {
    description: 'Markaların seni keşfetmesini bekleme: Spotlight ile keşifte öne çık, profilini kimin gördüğünü takip et.',
    plans: ['ibasic', 'ipro'],
  },
  brand: {
    description: 'Doğru influencer’ı daha hızlı bul: akıllı eşleştirme, uyum skoru ve öne çıkan ilanlar.',
    plans: ['mbasic', 'mpro'],
  },
}

/** Spotlight paket sayfası (influencer ve marka aynı düzen). Satın alma kapalı; planları admin açar. */
export default function SpotlightPlansPage({ role }: { role: Role }) {
  const router = useRouter()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('mo')
  const [processing, setProcessing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [spotlightActive, setSpotlightActive] = useState(false)
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [basicPlan, proPlan] = COPY[role].plans

  useEffect(() => {
    const checkStatus = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setUserId(session.user.id)

      // Önce sunucu süresi dolanları kapatır
      try {
        await checkSpotlightStatus(session.user.id)
      } catch (e) {
        console.error('Spotlight check failed', e)
      }

      const { data } = await supabase
        .from('users')
        .select('role, spotlight_active, spotlight_plan')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setUserRole(data.role) // rol DB'den; user_metadata güvenilmez
        setSpotlightActive(!!data.spotlight_active)
        if (data.spotlight_active) setSubscriptionTier(data.spotlight_plan || basicPlan)
      }
    }
    checkStatus()
  }, [basicPlan])

  const handleCancel = async () => {
    if (!userId) return
    setProcessing(true)
    try {
      const result = await cancelSpotlightPlan(userId)
      if (result.success) {
        toast.success('Üyeliğin iptal edildi.')
        setSpotlightActive(false)
        setSubscriptionTier(null)
        setConfirmCancel(false)
        router.refresh()
      } else {
        toast.error(result.error || 'İptal işlemi başarısız.')
      }
    } catch {
      toast.error('İşlem sırasında hata oluştu.')
    } finally {
      setProcessing(false)
    }
  }

  const wrongRole = userRole !== null && userRole !== role && userRole !== 'admin'
  const buttonText = wrongRole ? (role === 'brand' ? 'Marka hesabı gerekli' : 'Influencer hesabı gerekli') : 'Satın alma yakında'

  return (
    <div className="grid gap-6">
      <PageHeader title="Spotlight" description={COPY[role].description} />

      <SpotlightFeatureList features={FEATURES[role]} />

      <section className="grid gap-4" aria-labelledby="spotlight-paketler">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="spotlight-paketler" className="text-[17px] font-semibold tracking-tight text-ink">Paketler</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-faint">Yıllık ödemede iki ay ücretsiz.</p>
          </div>
          <Segmented
            label="Ödeme dönemi"
            value={billingInterval}
            onSelect={(v) => setBillingInterval(v as BillingInterval)}
            items={[
              { value: 'mo', label: 'Aylık' },
              { value: 'yr', label: 'Yıllık' },
            ]}
          />
        </div>

        {!spotlightActive && (
          <Notice tone="info">
            Satın alma yakında açılıyor. Paketi şimdi kullanmak istersen{' '}
            <a href="mailto:destek@influmatch.net" className="text-gold hover:underline">destek@influmatch.net</a> adresine yaz.
          </Notice>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <PricingCard
            title="Spotlight Basic"
            price={planPrice(basicPlan, billingInterval).price}
            interval={billingInterval}
            features={planFeatures(basicPlan)}
            buttonText={buttonText}
            isCurrentPlan={spotlightActive && subscriptionTier === basicPlan}
            disabled
            onCancel={() => setConfirmCancel(true)}
          />
          <PricingCard
            title="Spotlight Pro"
            price={planPrice(proPlan, billingInterval).price}
            interval={billingInterval}
            features={planFeatures(proPlan)}
            recommended
            buttonText={buttonText}
            isUpgrade={spotlightActive && subscriptionTier === basicPlan}
            isCurrentPlan={spotlightActive && subscriptionTier === proPlan}
            disabled
            onCancel={() => setConfirmCancel(true)}
          />
        </div>
      </section>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        loading={processing}
        tone="danger"
        title="Spotlight üyeliği iptal edilsin mi?"
        description="Spotlight ayrıcalıkların hemen kapanır. Bu işlem geri alınamaz."
        confirmLabel="Üyeliği iptal et"
      />
    </div>
  )
}
