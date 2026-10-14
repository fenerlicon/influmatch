import Link from 'next/link'
import type { ReactNode } from 'react'
import { BadgeCheck, Briefcase, Building2 } from 'lucide-react'
import { Eyebrow } from '@/components/ui'

function Logo() {
  return (
    <Link href="/" className="text-[15px] font-bold tracking-[0.02em] text-ink" aria-label="Influmatch ana sayfa">
      INFLU<span className="text-gold">MATCH</span>
    </Link>
  )
}

/**
 * Giriş / kayıt / şifre ekranlarının ortak kabuğu (design/redesign/giris.html):
 * solda tanıtım paneli (geniş ekranda), sağda tek sütun form.
 */
export default function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background text-ink lg:grid-cols-[0.8fr_1.2fr]">
      <aside className="hidden flex-col border-r border-line bg-gradient-to-br from-gold/[0.06] via-transparent via-50% to-transparent px-12 py-10 lg:flex">
        <Logo />
        <div className="mt-auto max-w-[440px]">
          <h2 className="mb-4 font-display text-[46px] font-normal leading-[1.08]">
            Doğrulanmış profiller, <em className="text-gold">net</em> anlaşmalar.
          </h2>
          <p className="text-ink-muted">Teklif, anlaşma özeti, teslimat ve ödeme teyidi tek yerde.</p>
          <ul className="mt-6 grid gap-2.5 text-sm text-ink-muted">
            <li className="flex items-center gap-2.5"><BadgeCheck className="h-4 w-4 text-gold" aria-hidden />Her influencer hesabı biyografi koduyla doğrulanır</li>
            <li className="flex items-center gap-2.5"><Building2 className="h-4 w-4 text-gold" aria-hidden />Markalar vergi levhası ve kurumsal e-postayla onaylanır</li>
            <li className="flex items-center gap-2.5"><Briefcase className="h-4 w-4 text-gold" aria-hidden />Her iş birliği adım adım takip edilir</li>
          </ul>
        </div>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-6 lg:items-center lg:justify-center lg:py-10">
        <div className="mb-8 lg:hidden"><Logo /></div>
        <div className="w-full max-w-[380px] sm:mx-auto lg:mx-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 font-display text-[38px] font-normal leading-[1.1]">{title}</h1>
          {description && <p className="mt-2 text-[14px] text-ink-muted">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
