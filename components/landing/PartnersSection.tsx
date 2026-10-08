
import Image from 'next/image'

// Yalnızca hesap doğrulama ve istatistik çekmede gerçekten desteklenen platformlar.
// Resmi ortaklık iddiası yok (9.1-S2).
const PARTNERS = [
  {
    name: 'Instagram',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
  },
  {
    name: 'TikTok',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
  },
]

export default function PartnersSection() {
  return (
    <section className="relative w-full border-y border-white/5 bg-white/[0.02] py-12 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.5em] text-soft-gold/60 font-medium">Platformlar</p>
            <h3 className="mt-2 text-lg font-semibold text-white/80">Desteklenen Platformlar</h3>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-10 sm:gap-x-16">
            {PARTNERS.map((partner) => (
              <div key={partner.name} className="relative group flex items-center justify-center transition-all duration-500">
                <div 
                  className={`relative transition-all duration-500 group-hover:opacity-100 group-hover:brightness-100 group-hover:invert-0 group-hover:scale-110 ${
                    partner.name === 'Instagram' 
                      ? 'h-8 w-8 sm:h-10 sm:w-10 grayscale opacity-40 group-hover:grayscale-0' 
                      : 'h-8 w-24 sm:h-12 sm:w-36 brightness-0 invert opacity-30'
                  }`}
                >
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
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
