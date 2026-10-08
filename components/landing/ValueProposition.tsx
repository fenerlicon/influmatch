interface ValueCard {
  title: string
  description: string
}

export default function ValueProposition() {
  const valueCards: ValueCard[] = [
    {
      title: 'Komisyonsuz Çalışma',
      description: 'Aracı ve komisyon yok. Ödemeler doğrudan markadan influencera yapılır.',
    },
    {
      title: 'Gelişmiş Filtreleme',
      description: 'Hedef kitlenize en uygun influencerları kolayca bulun.',
    },
    {
      title: 'Vitrin Özelliği',
      description: 'Başarılı kampanyalarınızı ve profilinizi öne çıkarın.',
    },
    {
      title: 'Yönetim Paneli',
      description: 'Tüm işbirliklerinizi tek bir yerden yönetin.',
    },
  ]

  const highlightList = [
    'Rol bazlı özelleştirilmiş akış',
    'Teklif durumu takibi',
    'Doğrudan iletişim imkanı',
  ]

  return (
    <section id="hakkimizda" className="relative overflow-hidden px-6 py-20 md:px-12 lg:px-24 xl:px-32">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#0f0f16] to-[#050506] opacity-80" />
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1fr]">
          <div className="glass-panel rounded-[32px] p-8">
            <p className="text-sm uppercase tracking-[0.4em] text-soft-gold/80">
              NEDEN BİZ?
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
              Neden <span className="text-soft-gold">Influmatch</span>?
            </h2>
            <p className="mt-4 text-base text-gray-300">
              Geleneksel ajans modellerinin aksine, Influmatch size özgürlük ve kontrol sağlar. Aracıları ortadan kaldırarak maliyetleri düşürür ve verimliliği artırırız.
            </p>
            <ul className="mt-8 space-y-4 text-gray-200">
              {highlightList.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-soft-gold" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl border border-soft-gold/40 bg-soft-gold/10 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-soft-gold">
                HEDEFİMİZ
              </p>
              <p className="mt-3 text-lg text-white">
                Influencer marketing dünyasını daha şeffaf, erişilebilir ve verimli hale getirmek.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {valueCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[28px] border border-white/5 bg-white/5 p-6 transition hover:border-soft-gold/50 hover:bg-white/10"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-soft-gold/70">
                  ÖZELLİK
                </p>
                <h3 className="mt-3 text-xl font-semibold text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm text-gray-300">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
