'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import PricingCard from '@/components/spotlight/PricingCard'
import { Eyebrow, Segmented } from '@/components/ui'
import { planFeatures, planPrice, type BillingInterval, type SpotlightPlanCode } from '@/lib/spotlight-plans'

type Role = 'brand' | 'influencer'

const PLANS: Record<Role, [SpotlightPlanCode, SpotlightPlanCode]> = {
  influencer: ['ibasic', 'ipro'],
  brand: ['mbasic', 'mpro'],
}

export default function PublicSpotlightPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Role>('influencer')
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('mo')
  const [basicPlan, proPlan] = PLANS[activeTab]
  const signup = () => router.push(`/signup?role=${activeTab}`)

  return (
    <div className="min-h-screen bg-background text-ink">
      <LandingHeader />
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 md:py-14">
        <Eyebrow className="text-gold">Spotlight</Eyebrow>
        <h1 className="mb-2 mt-3 font-display text-[36px] font-normal leading-[1.1] md:text-[44px]">Öne çıkmak isteyenler için</h1>
        <p className="mb-6 max-w-2xl text-ink-muted">
          Influencerlar keşifte üst sıralarda listelenir ve profillerini kimin gördüğünü takip eder; markalar akıllı eşleştirme önerilerini
          ve uyum skorlarını görür. Temel kullanım ücretsizdir.
        </p>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Paket türü"
            value={activeTab}
            onSelect={(v) => setActiveTab(v as Role)}
            items={[
              { value: 'influencer', label: 'Influencerlar için' },
              { value: 'brand', label: 'Markalar için' },
            ]}
          />
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

        <div className="grid gap-4 md:grid-cols-2">
          <PricingCard
            title="Spotlight Basic"
            price={planPrice(basicPlan, billingInterval).price}
            interval={billingInterval}
            features={planFeatures(basicPlan)}
            buttonText="Ücretsiz kayıt ol"
            onSelect={signup}
          />
          <PricingCard
            title="Spotlight Pro"
            price={planPrice(proPlan, billingInterval).price}
            interval={billingInterval}
            features={planFeatures(proPlan)}
            recommended
            buttonText="Ücretsiz kayıt ol"
            onSelect={signup}
          />
        </div>
        <p className="mt-4 text-[12.5px] text-ink-faint">Yıllık ödemede iki ay ücretsiz. Paket satın alma yakında açılıyor; kayıt ve temel kullanım ücretsiz.</p>
      </main>
      <LandingFooter />
    </div>
  )
}
