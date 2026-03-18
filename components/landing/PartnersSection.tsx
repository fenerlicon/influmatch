
import Image from 'next/image'

const PARTNERS = [
  {
    name: 'TikTok',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
    isOfficial: true,
  },
  {
    name: 'Instagram',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Instagram_logo.svg',
  },
  {
    name: 'Meta',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg',
  },
  {
    name: 'YouTube',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg',
  },
  {
    name: 'Google',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
  }
]

export default function PartnersSection() {
  return (
    <section className="relative w-full border-y border-white/5 bg-white/[0.02] py-12 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.5em] text-soft-gold/60 font-medium">Güvenilir Altyapı</p>
            <h3 className="mt-2 text-lg font-semibold text-white/80">Resmi Entegrasyon Ortaklarımız</h3>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-10 sm:gap-x-16">
            {PARTNERS.map((partner) => (
              <div key={partner.name} className="relative group flex items-center justify-center transition-all duration-500">
                <div className="relative h-8 w-24 sm:h-12 sm:w-36 transition-all duration-500 brightness-0 invert opacity-30 group-hover:opacity-100 group-hover:brightness-100 group-hover:invert-0 group-hover:scale-110">
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    fill
                    className="object-contain"
                  />
                </div>
                {partner.isOfficial && (
                  <span className="absolute -top-4 -right-2 rounded-full bg-soft-gold/10 border border-soft-gold/30 px-2 py-0.5 text-[7px] font-bold text-soft-gold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-1 group-hover:translate-y-0">
                    Sistem Ortağı
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Şık bir arka plan efekt (subtle glow) */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-64 w-[80%] -translate-x-1/2 -translate-y-1/2 bg-soft-gold/5 blur-[120px]" aria-hidden="true" />
    </section>
  )
}
