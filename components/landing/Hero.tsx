import Link from 'next/link'

const featurePills = [
  'Rol bazlı kayıt akışı',
  'Kategori filtreleri',
  'Şeffaf teklif yönetimi',
]

const stats = [
  { label: 'TAMAMEN ÜCRETSİZ', value: '%0 Komisyon' },
  { label: 'ARACI YOK', value: 'Direkt İletişim' },
  { label: 'GÜVENİLİR KİTLE', value: 'Onaylı Hesaplar' },
  { label: 'ŞEFFAF VERİLER', value: 'Detaylı Analiz' },
  { label: 'KOLAY SÜREÇ', value: 'Hızlı Eşleşme' },
  { label: 'HER ZAMAN YANINDA', value: '7/24 Destek' },
]

const workflowSteps = [
  {
    title: 'Rolünü Seç',
    description:
      'Influencerım veya Markayım diyerek kayıt sürecini başlat ve panelini aç.',
  },
  {
    title: 'Teklif Oluştur / Al',
    description:
      'Markalar güvenli form ile teklif yollar, influencer tarafı tüm detayları görür.',
  },
  {
    title: 'Onayla & İletişime Geç',
    description:
      'Teklif kabul edilince marka tarafı iletişim bilgilerine erişir ve süreç başlar.',
  },
]

const roleCards = [
  {
    title: 'Influencerım',
    description: 'Profilini vitrine taşı, teklifleri tek panelden yönet.',
    href: '/dashboard/influencer',
  },
  {
    title: 'Markayım',
    description: 'Kategoriye göre keşfet, doğru profillere hızlı teklif gönder.',
    href: '/dashboard/brand',
  },
]

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative px-6 pb-12 pt-24 md:px-12 lg:px-24 xl:px-32"
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-40 blur-3xl" />
      <div className="max-w-6xl mx-auto grid gap-16 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-soft-gold/80">
            Influmatch • Tamamen Ücretsiz
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
            Doğru influencer işbirlikleri{' '}
            <span className="text-soft-gold">tek platformda</span>
          </h1>
          <p className="mt-6 text-lg text-gray-300 leading-relaxed">
            Influmatch, markalar ile influencer&apos;ları <span className="text-white font-medium">ajans veya komisyon olmadan</span> buluşturan güvenli, hızlı ve şeffaf pazar yeridir. Rolünü seç, kaydol ve sana özel panelinde tekliflerini yönet.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {featurePills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200"
              >
                {pill}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/signup-role"
              className="glow-effect rounded-full bg-soft-gold px-8 py-4 text-base font-semibold text-background transition-all hover:bg-champagne hover:text-background"
            >
              Hemen Başla
            </Link>
            <Link
              href="/signup-role"
              className="rounded-full border border-white/15 px-8 py-4 text-base font-semibold text-white transition hover:border-soft-gold/60 hover:text-soft-gold"
            >
              Influencerları Keşfet
            </Link>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            Zaten hesabın var mı?{' '}
            <Link
              href="/login"
              className="font-semibold text-soft-gold underline-offset-4 hover:underline"
            >
              Giriş Yap
            </Link>
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/5 bg-white/5 p-5 text-center transition hover:border-soft-gold/30 hover:bg-white/10"
              >
                <p className="text-2xl font-semibold text-soft-gold md:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-soft-gold/30 via-transparent to-transparent blur-3xl" />
          <div className="glass-panel rounded-[32px] p-8 shadow-glow">
            <p className="text-sm uppercase tracking-[0.2em] text-soft-gold/90">
              Teklif Döngüsü
            </p>
            <div className="mt-6 space-y-5">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-white/5 bg-black/20 p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-soft-gold font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {roleCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-soft-gold/60 hover:bg-white/10"
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-soft-gold/70">
                    Rol
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-white">
                    {card.title}
                  </h4>
                  <p className="mt-1 text-sm text-gray-400">{card.description}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-soft-gold">
                    Paneli Gör
                    <svg
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3.5 8H12.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8.5 4L12.5 8L8.5 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

