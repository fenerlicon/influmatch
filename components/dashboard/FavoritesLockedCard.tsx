import Link from 'next/link'
import { Lock } from 'lucide-react'

/**
 * Ücretsiz markada (sınırlar açıkken) favoriler ve listeler yerine gösterilen açıklama kartı.
 * Fiyat / iddia içermez. Kayıtlı favoriler ve listeler silinmez; Spotlight ile geri gelir.
 */
export default function FavoritesLockedCard() {
  return (
    <section className="rounded-3xl border border-soft-gold/30 bg-gradient-to-br from-[#1A1712] to-[#0C0D10] p-6 text-white shadow-glow">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-soft-gold/10 text-soft-gold">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-semibold">Favoriler ve listeler Spotlight markalara özel</h2>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
        Profilleri favorilere eklemek ve isimli listelere ayırmak Spotlight markalar için açık. Daha önce kaydettiğin
        favoriler ve listeler silinmedi; Spotlight&apos;a geçtiğinde olduğu gibi geri gelir.
      </p>
      <div className="mt-5">
        <Link
          href="/dashboard/spotlight/brand"
          className="inline-flex rounded-full bg-soft-gold px-6 py-2 text-sm font-semibold text-black transition hover:bg-white"
        >
          Spotlight&apos;ı incele
        </Link>
      </div>
    </section>
  )
}
