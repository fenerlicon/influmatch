import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5 bg-[#0B0C10] py-12 px-6 md:px-12 lg:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center md:items-start">
            <span className="text-xl font-bold tracking-wider text-white">
              INFLU<span className="text-soft-gold">MATCH</span>
            </span>
            <p className="mt-2 text-sm text-gray-400 text-center md:text-left">
              Influencer ve Markaları Buluşturan Akıllı Platform.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-gray-400">
            <Link href="/" className="hover:text-soft-gold">Ana Sayfa</Link>
            <Link href="/discover" className="hover:text-soft-gold">Keşfet</Link>
            <Link href="/badges" className="hover:text-soft-gold">Rozetler</Link>
            <Link href="/#sss" className="hover:text-soft-gold">S.S.S</Link>
            <Link href="/legal/privacy" className="hover:text-soft-gold">Gizlilik Politikası</Link>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-white/5" />

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-gray-500 md:flex-row">
          <p>&copy; {currentYear} Influmatch. Tüm hakları saklıdır.</p>
          <p className="flex items-center gap-1.5">
            <span>Influmatch, gücünü</span>
            <a 
              href="https://www.socialartmedya.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-semibold text-soft-gold hover:text-white transition-colors"
            >
              Social Art Medya
            </a>
            <span>'dan alır.</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
