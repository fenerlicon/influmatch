import { BadgeCheck, Award, Star, Shield } from 'lucide-react'
import Link from 'next/link'

const badgeFeatures = [
  {
    icon: BadgeCheck,
    title: 'Mavi Tik Rozeti',
    description: 'Doğrulanmış hesaplar için özel mavi tik rozeti. Profilinizin güvenilirliğini artırın.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    icon: Award,
    title: 'Başarı Rozetleri',
    description: 'Tamamladığınız kampanyalar ve başarılarınız için özel rozetler kazanın.',
    color: 'text-soft-gold',
    bgColor: 'bg-soft-gold/10',
    borderColor: 'border-soft-gold/30',
  },
  {
    icon: Star,
    title: 'Premium Rozet',
    description: 'Premium üyelik ile özel rozetler ve vitrin önceliği kazanın.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    icon: Shield,
    title: 'Güven Rozeti',
    description: 'Güvenilir iş ortaklıkları ve başarılı kampanyalar için güven rozeti.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
]

export default function BadgesSection() {
  return (
    <section className="relative overflow-hidden px-6 py-20 md:px-12 lg:px-24 xl:px-32">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#050506] via-[#0f0f16] to-transparent opacity-80" />
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold/80">
            Rozet Sistemi
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
            Rozetler <span className="text-soft-gold">Bizim İçin</span> Önemli
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-300">
            Profilinizdeki rozetler, başarılarınızı ve güvenilirliğinizi gösterir. 
            Her rozet, markaların sizi tercih etmesi için bir neden.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {badgeFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className={`group relative overflow-hidden rounded-3xl border ${feature.borderColor} ${feature.bgColor} p-6 transition duration-300 hover:border-opacity-60 hover:shadow-lg`}
              >
                <div className="relative z-10">
                  <div className={`mb-4 inline-flex rounded-2xl ${feature.bgColor} p-3`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm text-gray-300">{feature.description}</p>
                </div>
                <div className="absolute inset-0 -z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 rounded-3xl border border-soft-gold/30 bg-gradient-to-br from-soft-gold/10 to-transparent p-8 text-center">
          <h3 className="text-2xl font-semibold text-white">
            Rozetlerinizi Keşfedin
          </h3>
          <p className="mt-2 text-gray-300">
            Profilinizde hangi rozetlere sahip olduğunuzu görün ve yeni rozetler kazanmak için 
            kampanyalara katılın.
          </p>
          <Link
            href="/badges"
            className="mt-6 inline-flex items-center justify-center rounded-full border border-soft-gold/60 bg-soft-gold/20 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30"
          >
            Rozetlerimi Gör
          </Link>
        </div>
      </div>
    </section>
  )
}

