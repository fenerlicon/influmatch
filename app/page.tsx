import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import {
  ArrowRight, BadgeCheck, Bell, Building2, Check, Eye, Coins, Instagram, Music2, ShieldCheck, Sparkles, UserRoundCheck, Wand2,
} from 'lucide-react'
import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import HowItWorks from '@/components/landing/HowItWorks'
import Faq from '@/components/landing/Faq'
import { Avatar, ButtonLink, Card, Chip, Eyebrow, Notice, VerifiedTick } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface HomeProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function Home({ searchParams }: HomeProps) {
  // Check for error parameters from Supabase email verification
  const error = typeof searchParams.error === 'string' ? searchParams.error : null
  const errorCode = typeof searchParams.error_code === 'string' ? searchParams.error_code : null

  if (error || errorCode) {
    let errorMessage = 'verification_failed'
    if (errorCode === 'otp_expired') {
      errorMessage = 'email_link_expired'
    } else if (error === 'access_denied') {
      errorMessage = 'verification_denied'
    }
    redirect(`/login?error=${errorMessage}`)
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <LandingHeader />
      <main>
        {/* Hero */}
        <div className="mx-auto grid max-w-[1160px] items-center gap-10 px-4 py-12 sm:px-6 md:py-[88px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-2xl border border-line bg-surface-3 px-3 py-1.5 text-xs text-ink-muted [&_svg]:h-3.5 [&_svg]:w-3.5">
              <Instagram aria-hidden /> Instagram ve <Music2 aria-hidden /> TikTok için influencer ve UGC bulma platformu
            </p>
            <h1 className="mb-5 mt-[18px] font-display text-[46px] font-normal leading-[1.02] tracking-[-0.01em] md:text-[72px]">
              Doğru influencer&apos;ı bul.
              <br />
              <em className="text-gold">Aracısız</em> çalış.
            </h1>
            <p className="mb-[30px] max-w-[520px] text-[17px] leading-relaxed text-ink-muted md:text-lg">
              Influmatch markaları doğrulanmış influencer ve UGC üreticileriyle buluşturur. Teklif, anlaşma, teslimat ve ödeme teyidi tek yerde.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <ButtonLink href="/signup" variant="primary" size="lg" rightIcon={<ArrowRight />}>
                Ücretsiz başla
              </ButtonLink>
              <ButtonLink href="#nasil" size="lg">
                Nasıl çalışır
              </ButtonLink>
            </div>
            <div className="mt-[26px] flex flex-wrap gap-x-[18px] gap-y-2 text-[13px] text-ink-faint">
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-[15px] w-[15px] text-gold" aria-hidden />Doğrulanmış hesaplar</span>
              <span className="inline-flex items-center gap-1.5"><Building2 className="h-[15px] w-[15px] text-gold" aria-hidden />Onaylı markalar</span>
              <span className="inline-flex items-center gap-1.5"><Coins className="h-[15px] w-[15px] text-gold" aria-hidden />Komisyonsuz anlaşma</span>
            </div>
          </div>

          {/* Ürün önizlemesi: gerçek ekranlardan parçalar, sahte rakam yok */}
          <div className="relative h-[420px] md:h-[440px]" aria-hidden="true">
            <Card padded className="absolute left-0 right-0 top-0 shadow-2xl sm:right-[60px]">
              <div className="flex items-center gap-3">
                <Avatar name="Elif Yıldız" size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold">Elif Yıldız <VerifiedTick /></div>
                  <div className="text-xs text-ink-faint">Yeme & İçme · İstanbul</div>
                </div>
                <Chip tone="success" className="ml-auto"><ShieldCheck aria-hidden />Doğrulandı</Chip>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                <Chip>Reels</Chip>
                <Chip>Story</Chip>
                <Chip>UGC video</Chip>
                <Chip>Pazarlığa açık</Chip>
              </div>
            </Card>
            <Card padded className="absolute left-6 right-0 top-[190px] shadow-2xl sm:left-[70px]">
              <div className="flex items-center justify-between">
                <Eyebrow>İş</Eyebrow>
                <Chip tone="info">İçerik hazırlanıyor</Chip>
              </div>
              <div className="mt-2 font-semibold">Sonbahar menüsü lansmanı</div>
              <div className="mb-2 mt-3 flex gap-1">
                {[true, true, true, false, false].map((on, i) => (
                  <i key={i} className={on ? 'h-1 flex-1 rounded-full bg-gold' : 'h-1 flex-1 rounded-full bg-surface-3'} />
                ))}
              </div>
              <div className="text-xs text-ink-faint">Teklif → Anlaşma → İçerik → Yayın → Ödeme teyidi</div>
            </Card>
            <Card accent className="absolute bottom-0 left-5 w-[260px] p-3.5 shadow-2xl">
              <div className="flex items-center gap-2 text-[13px]">
                <Bell className="h-[15px] w-[15px] text-gold" />
                <span><b className="font-medium">Yeni teklif</b> <span className="text-ink-muted">Nara Kahve&apos;den</span></span>
              </div>
            </Card>
          </div>
        </div>

        {/* Nasıl çalışır */}
        <section id="nasil" className="scroll-mt-4 border-t border-line py-16 md:py-[88px]">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
            <SectionHead eyebrow="Nasıl çalışır" title={<>Üç adımda <em className="text-gold">iş birliği</em></>}>
              Markalar keşfeder ve teklif gönderir, üreticiler ilanlara başvurur. Kabul edilen her şey aynı akıştan geçer.
            </SectionHead>
            <HowItWorks />
          </div>
        </section>

        {/* Doğrulama */}
        <section id="dogrulama" className="scroll-mt-4 border-t border-line py-16 md:py-[88px]">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
            <SectionHead eyebrow="Doğrulama" title={<>Karşındakinin <em className="text-gold">gerçek</em> olduğunu bil</>}>
              Platformda yalnızca doğrulanmış hesaplar listelenir.
            </SectionHead>
            <div className="grid gap-4 md:grid-cols-2">
              <VerifyCard
                icon={<UserRoundCheck className="h-5 w-5 text-gold" aria-hidden />}
                title="Influencer ve UGC"
                items={[
                  'Instagram veya TikTok hesabı biyografi koduyla doğrulanır.',
                  'Takipçi ve etkileşim verisi hesabın kendisinden gelir.',
                  'Tamamlanan iş birlikleri profilde görünür.',
                ]}
              />
              <VerifyCard
                icon={<Building2 className="h-5 w-5 text-gold" aria-hidden />}
                title="Markalar"
                items={[
                  'Vergi levhası ve kurumsal kimlik incelenir.',
                  'Şirket alan adıyla kurumsal e-posta doğrulanır.',
                  'Ödeme teyitleri marka profilinde görünür.',
                ]}
              />
            </div>
          </div>
        </section>

        {/* Spotlight */}
        <section id="spotlight" className="scroll-mt-4 border-t border-line py-16 md:py-[88px]">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
            <Card accent className="grid items-center gap-8 p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
              <div>
                <Eyebrow className="text-gold">Spotlight</Eyebrow>
                <h2 className="my-3 font-display text-[36px] font-normal leading-[1.1] md:text-[44px]">Öne çıkmak isteyenler için</h2>
                <p className="mb-[22px] text-ink-muted">
                  Influencer&apos;lar keşifte öncelikli listelenir, markalar akıllı eşleştirme önerilerini görür.
                </p>
                <ButtonLink href="/spotlight">Paketleri incele</ButtonLink>
              </div>
              <div className="grid gap-2.5">
                <Notice tone="gold" icon={Eye}>Profil görüntülenme sayıları</Notice>
                <Notice tone="gold" icon={Wand2}>Akıllı eşleştirme ve uyum skoru</Notice>
                <Notice tone="gold" icon={Sparkles}>Keşifte öncelikli listeleme</Notice>
              </div>
            </Card>
          </div>
        </section>

        {/* S.S.S. */}
        <section id="sss" className="scroll-mt-4 border-t border-line py-16 md:py-[88px]">
          <div className="mx-auto max-w-[760px] px-4 sm:px-6">
            <SectionHead eyebrow="S.S.S." title="Merak edilenler" />
            <Faq />
          </div>
        </section>

        {/* Son çağrı */}
        <section className="border-t border-line py-20 text-center md:py-24">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
            <h2 className="mb-4 font-display text-[36px] font-normal leading-[1.1] md:text-[56px]">
              İlk iş birliğin <em className="text-gold">bir teklif</em> uzağında.
            </h2>
            <p className="mb-7 text-ink-muted">Ücretsiz başla, hesabını doğrula, keşfetmeye başla.</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <ButtonLink href="/signup?role=brand" variant="primary" size="lg">Marka olarak başla</ButtonLink>
              <ButtonLink href="/signup?role=influencer" size="lg">Üretici olarak başla</ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-10 max-w-[640px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="my-3 font-display text-[36px] font-normal leading-[1.1] tracking-[-0.01em] md:text-[46px]">{title}</h2>
      {children && <p className="text-base text-ink-muted">{children}</p>}
    </div>
  )
}

function VerifyCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <Card padded className="p-7">
      <div className="flex items-center gap-2.5">
        {icon}
        <h3 className="text-[19px] font-semibold tracking-tight">{title}</h3>
      </div>
      <ul className="mt-[18px] grid gap-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm text-ink-muted">
            <Check className="mt-0.5 h-[17px] w-[17px] flex-none text-success" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  )
}
