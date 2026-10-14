import Link from 'next/link'
import { ButtonLink } from '@/components/ui'

const LINKS = [
  { href: '/#nasil', label: 'Nasıl çalışır' },
  { href: '/#dogrulama', label: 'Doğrulama' },
  { href: '/#spotlight', label: 'Spotlight' },
  { href: '/#sss', label: 'S.S.S.' },
]

/** Tanıtım sayfalarının üst çubuğu (design/redesign/ana-sayfa.html). */
export default function LandingHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-[68px] max-w-[1160px] items-center gap-7 px-4 sm:px-6">
        <Link href="/" className="text-[15px] font-bold tracking-[0.02em] text-ink" aria-label="Influmatch ana sayfa">
          INFLU<span className="text-gold">MATCH</span>
        </Link>
        <nav className="hidden gap-[22px] text-sm text-ink-muted md:flex" aria-label="Sayfa bölümleri">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost">Giriş yap</ButtonLink>
          <ButtonLink href="/signup" variant="primary">Ücretsiz başla</ButtonLink>
        </div>
      </div>
    </header>
  )
}
