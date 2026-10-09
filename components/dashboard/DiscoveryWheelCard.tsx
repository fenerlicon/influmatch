'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
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
    <section className="rounded-3xl border border-soft-gold/30 bg-gradient-to-br from-[#1A1712] to-[#0C0D10] p-6 text-white shadow-glow">
      <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Keşif çarkı</p>
      {variant === 'profile' ? (
        <h2 className="mt-2 text-xl font-semibold">Bu profil şu anki keşif çarkında değil</h2>
      ) : (
        <h2 className="mt-2 text-xl font-semibold">
          {expiresAt ? 'Bugünkü profillerin hazır' : 'Çarkı çevir, sana uygun profilleri gör'}
        </h2>
      )}
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
        Her {windowHours} saatte bir çarkı çevirebilirsin. Çark, markanın sektörüne uygun {profilesPerSpin} doğrulanmış
        influencer/UGC profilini seçer; bu profiller {windowHours} saat boyunca açık kalır. Sonraki çevirişte, daha önce
        gösterilmemiş profiller gelir. Teklif gönderdiğin, iş birliği yaptığın ya da ilanına başvuran profilleri her zaman
        açabilirsin. Spotlight markalar tüm profilleri görür.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {expiresAt ? (
          <>
            <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200">
              Profiller {formatDateTime(expiresAt)} tarihine kadar açık; sonra çarkı yeniden çevirebilirsin.
            </span>
            {variant === 'profile' && (
              <Link
                href="/dashboard/brand/discover"
                className="rounded-2xl border border-soft-gold/50 bg-soft-gold/10 px-5 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
              >
                Çarktaki profillere dön
              </Link>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={handleSpin}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-2xl border border-soft-gold/50 bg-soft-gold/10 px-5 py-2.5 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Çarkı çevir
          </button>
        )}
        <Link href="/dashboard/spotlight/brand" className="text-sm text-gray-400 underline-offset-4 transition hover:text-white hover:underline">
          Spotlight&apos;ı incele
        </Link>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  )
}
