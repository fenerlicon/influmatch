'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Instagram, Music2, ShieldCheck } from 'lucide-react'
import InstagramConnect from '@/components/dashboard/InstagramConnect'
import TikTokConnect from '@/components/dashboard/TikTokConnect'
import SignOutButton from '@/components/dashboard/SignOutButton'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import { Card, CardBody, Notice, Segmented } from '@/components/ui'

type Platform = 'instagram' | 'tiktok'

interface SocialVerificationStepProps {
  userId: string
  instagramUsername: string
  tiktokUsername: string
  defaultPlatform: Platform
}

const STEPS = [
  'Kullanıcı adını yaz ve doğrulama kodunu al.',
  'Kodu Instagram veya TikTok biyografine ekle.',
  '"Kontrol et" de. Doğrulandıktan sonra kodu biyografinden silebilirsin.',
]

export default function SocialVerificationStep({ userId, instagramUsername, tiktokUsername, defaultPlatform }: SocialVerificationStepProps) {
  const router = useRouter()
  const [platform, setPlatform] = useState<Platform>(defaultPlatform)
  const [isVerified, setIsVerified] = useState(false)

  const handleVerified = () => {
    setIsVerified(true)
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <OnboardingShell
      eyebrow="Son adım"
      title="Hesabını doğrula"
      description={
        <>
          Markalar gördükleri verilerin sana ait olduğundan emin olur. Instagram veya TikTok hesaplarından <span className="text-ink">birini</span>{' '}
          doğrulaman yeterli; şifren asla istenmez.
        </>
      }
      steps={['Profil', 'Hesap doğrulama']}
      current={1}
      aside={<SignOutButton size="sm" />}
    >
      <ol className="mb-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 rounded-xl border border-line bg-surface-1 p-3.5 text-[13px] text-ink-muted sm:block">
            <span className="mb-2 grid h-6 w-6 flex-none place-items-center rounded-full bg-gold/10 text-xs font-semibold text-gold">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      {isVerified ? (
        <Notice tone="success" title="Hesabın doğrulandı.">Panele yönlendiriliyorsun…</Notice>
      ) : (
        <Card>
          <CardBody className="grid gap-5">
            <Segmented
              label="Platform"
              value={platform}
              onSelect={(v) => setPlatform(v as Platform)}
              items={[
                { value: 'instagram', label: <span className="inline-flex items-center gap-1.5"><Instagram className="h-4 w-4" aria-hidden />Instagram</span> },
                { value: 'tiktok', label: <span className="inline-flex items-center gap-1.5"><Music2 className="h-4 w-4" aria-hidden />TikTok</span> },
              ]}
            />
            {platform === 'instagram' ? (
              <InstagramConnect key="instagram" userId={userId} initialUsername={instagramUsername} onVerified={handleVerified} />
            ) : (
              <TikTokConnect key="tiktok" userId={userId} username={tiktokUsername} onVerified={handleVerified} />
            )}
          </CardBody>
        </Card>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-ink-faint">
        <ShieldCheck className="h-4 w-4 flex-none text-gold" aria-hidden />
        Doğrulama için hesabın herkese açık olmalı. Sorun yaşarsan destek@influmatch.net adresine yaz.
      </p>
    </OnboardingShell>
  )
}
