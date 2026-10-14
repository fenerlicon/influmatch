'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button, ButtonLink, Card, Eyebrow } from '@/components/ui'
import { spinDiscoveryWheel } from '@/app/dashboard/brand/discover/actions'

interface DiscoveryWheelCardProps {
  profilesPerSpin: number
  windowHours: number
  /** Süresi dolmamış çevirmenin bitişi; yoksa marka çarkı çevirebilir. */
  expiresAt: string | null
  /** Profil sayfasında kullanılırsa: bu profil güncel çarkta değil. */
  variant?: 'discover' | 'profile'
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Keşif çarkı açıklaması + "Çarkı çevir" düğmesi (ücretsiz marka, bayrak açıkken). Fiyat/iddia içermez. */
export default function DiscoveryWheelCard({ profilesPerSpin, windowHours, expiresAt, variant = 'discover' }: DiscoveryWheelCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSpin = () => {
    setError(null)
    startTransition(async () => {
      const result = await spinDiscoveryWheel()
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if (variant === 'profile') router.push('/dashboard/brand/discover')
      else router.refresh()
    })
  }

  return (
    <Card accent padded as="section" className="mb-5">
      <Eyebrow className="text-gold">Keşif çarkı</Eyebrow>
      <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-ink">
        {variant === 'profile' ? 'Bu profil şu anki keşif çarkında değil' : expiresAt ? 'Bugünkü profillerin hazır' : 'Çarkı çevir, sana uygun profilleri gör'}
      </h2>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Her {windowHours} saatte bir çarkı çevirebilirsin. Çark, markanın sektörüne uygun {profilesPerSpin} doğrulanmış
        influencer/UGC profilini seçer; bu profiller {windowHours} saat boyunca açık kalır. Sonraki çevirişte, daha önce
        gösterilmemiş profiller gelir. Teklif gönderdiğin, iş birliği yaptığın ya da ilanına başvuran profilleri her zaman
        açabilirsin. Spotlight markalar tüm profilleri görür.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {expiresAt ? (
          <>
            <span className="text-[13px] text-ink-muted">
              Profiller {formatDateTime(expiresAt)} tarihine kadar açık; sonra çarkı yeniden çevirebilirsin.
            </span>
            {variant === 'profile' && (
              <ButtonLink href="/dashboard/brand/discover" size="sm">
                Çarktaki profillere dön
              </ButtonLink>
            )}
          </>
        ) : (
          <Button variant="primary" size="sm" leftIcon={<RefreshCw />} loading={isPending} onClick={handleSpin}>
            Çarkı çevir
          </Button>
        )}
        <Link href="/dashboard/spotlight/brand" className="text-[13px] text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          Spotlight&apos;ı incele
        </Link>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Card>
  )
}
