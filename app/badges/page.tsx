import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import BadgeCatalog from '@/components/badges/BadgeCatalog'
import { Eyebrow } from '@/components/ui'

export default function BadgesPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <LandingHeader />
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 md:py-14">
        <Eyebrow>Rozetler</Eyebrow>
        <h1 className="mb-2 mt-3 font-display text-[36px] font-normal leading-[1.1] md:text-[44px]">Rozet sistemi</h1>
        <p className="mb-6 max-w-2xl text-ink-muted">Rozetler doğrulama ve platformdaki çalışma geçmişine göre verilir ve profilde görünür.</p>
        <BadgeCatalog />
      </main>
      <LandingFooter />
    </div>
  )
}
