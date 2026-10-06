'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Instagram, Loader2, Play, ShieldCheck } from 'lucide-react'
import InstagramConnect from '@/components/dashboard/InstagramConnect'
import TikTokConnect from '@/components/dashboard/TikTokConnect'
import SignOutButton from '@/components/dashboard/SignOutButton'

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
  '"Kontrol Et" de. Doğrulandıktan sonra kodu biyografinden silebilirsin.',
]

export default function SocialVerificationStep({
  userId,
  instagramUsername,
  tiktokUsername,
  defaultPlatform,
}: SocialVerificationStepProps) {
  const router = useRouter()
  const [platform, setPlatform] = useState<Platform>(defaultPlatform)
  const [isVerified, setIsVerified] = useState(false)

  const handleVerified = () => {
    setIsVerified(true)
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[32px] p-6 sm:p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">SON ADIM</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Hesabını Doğrula</h1>
          <p className="mt-2 text-gray-300">
            Influmatch&apos;teki her influencer ve UGC üreticisi gerçek hesabını doğrular; markalar gördükleri verilerin
            sana ait olduğundan emin olur. Instagram veya TikTok hesaplarından <strong className="text-white">birini</strong>{' '}
            doğrulaman yeterli. Şifren asla istenmez.
          </p>

          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-soft-gold/20 text-xs font-bold text-soft-gold">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {isVerified ? (
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-emerald-200">
              <CheckCircle2 className="h-6 w-6 shrink-0" />
              <span className="flex-1">Hesabın doğrulandı! Panele yönlendiriliyorsun...</span>
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="mt-8 flex gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
                {(
                  [
                    { id: 'instagram', label: 'Instagram', icon: Instagram },
                    { id: 'tiktok', label: 'TikTok', icon: Play },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlatform(id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      platform === id
                        ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-[#0C0D10] p-5 sm:p-6">
                {platform === 'instagram' ? (
                  <InstagramConnect key="instagram" userId={userId} initialUsername={instagramUsername} onVerified={handleVerified} />
                ) : (
                  <TikTokConnect key="tiktok" userId={userId} username={tiktokUsername} onVerified={handleVerified} />
                )}
              </div>
            </>
          )}

          <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-soft-gold" />
              Doğrulama için hesabın herkese açık olmalı. Sorun yaşarsan destek@influmatch.net adresine yaz.
            </p>
            <SignOutButton size="sm" />
          </div>
        </div>
      </div>
    </main>
  )
}
