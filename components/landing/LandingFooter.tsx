import Link from 'next/link'

/** Tanıtım sayfalarının alt bilgisi. */
export default function LandingFooter() {
  return (
    <footer className="border-t border-line py-7 text-[13px] text-ink-faint">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[13px] font-bold tracking-[0.02em] text-ink">
            INFLU<span className="text-gold">MATCH</span>
          </div>
          <p className="mt-1">
            © {new Date().getFullYear()} Influmatch · Gücünü{' '}
            <a href="https://www.socialartmedya.com" target="_blank" rel="noopener noreferrer" className="text-ink-muted hover:text-gold">
              Social Art Medya
            </a>
            &apos;dan alır.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-[18px] gap-y-2" aria-label="Alt bağlantılar">
          <Link href="/spotlight" className="hover:text-ink">Spotlight</Link>
          <Link href="/badges" className="hover:text-ink">Rozetler</Link>
          <Link href="/#sss" className="hover:text-ink">S.S.S.</Link>
          <Link href="/legal" className="hover:text-ink">Yasal</Link>
          <Link href="/legal?tab=privacy" className="hover:text-ink">Gizlilik</Link>
          <Link href="/feedback" className="hover:text-ink">Geri bildirim</Link>
        </nav>
      </div>
    </footer>
  )
}
