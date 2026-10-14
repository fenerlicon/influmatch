'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/utils/cn'

// Cevaplar canlıdaki metinden; iki madde koddaki gerçeğe göre güncellendi (TikTok doğrulaması canlıda,
// Spotlight maddeleri lib/spotlight-plans.ts ile aynı).
const FAQS = [
  {
    q: 'Influmatch tam olarak nedir?',
    a: "Influmatch, markalar ile influencer'ları veriye dayalı eşleştirmeyle bir araya getiren bir influencer marketing platformudur. Geleneksel ajans süreçlerini ortadan kaldırarak hızlı, veriye dayalı ve güvenilir iş birlikleri kurmanızı sağlar.",
  },
  {
    q: 'Platform nasıl çalışır?',
    a: "Markalar ilan açar ya da keşifte profilleri inceleyip doğrudan teklif gönderir. Influencer'lar kendilerine uygun ilanlara başvurur veya teklif alır. Anlaşma sağlandığında süreç İşler sayfasından şeffaf bir şekilde yönetilir.",
  },
  {
    q: 'Spotlight üyeliği ne işe yarar?',
    a: "Influencer'lar için Spotlight rozeti, keşifte öncelikli listeleme, profil görüntülenme sayıları ve uyum skoru analizi; markalar için akıllı eşleştirme önerileri, kampanya uyum skoru, benzer profil keşfi ve ilanların topluluk listesinde öne çıkması. Influencer Pro paketinde ayrıca Profil koçu (detaylı analiz), marka Pro paketinde keşifte \"Verisi olanlar\" ve \"Mavi tikli\" filtreleri vardır.",
  },
  {
    q: 'Ödemeler ve güvenlik nasıl sağlanıyor?',
    a: 'Influmatch, markalarla influencer\'ları bir araya getiren bir eşleştirme platformudur. Anlaşma sağladığınızda ödeme koşullarını ve yöntemini kendi aranızda belirlersiniz. Biz aracı olmaz veya komisyon almayız; iki tarafın ödeme teyidi İşler sayfasında kayıt altına alınır.',
  },
  {
    q: 'Hangi platformlar destekleniyor?',
    a: 'Instagram ve TikTok. Hesabınızı biyografinize eklediğiniz kısa bir kodla doğrularsınız; takipçi ve etkileşim verileri hesabın kendisinden gelir.',
  },
  {
    q: 'Üye olmak ücretli mi?',
    a: "Influmatch'e üye olmak ve profil oluşturmak ücretsizdir. Influencer'lar için ilanlara başvurmak, markalar için ilan oluşturmak ücretsizdir. Daha fazla görünürlük ve gelişmiş özellikler için Spotlight paketlerini tercih edebilirsiniz.",
  },
  {
    q: "Influmatch'in arkasında kim var?",
    a: "Influmatch, İstanbul'daki 360° dijital pazarlama, kreatif prodüksiyon ve reklam ajansı Social Art Medya tarafından geliştirilmiş ve desteklenen bir platformdur.",
  },
]

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="border-t border-line">
      {FAQS.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q} className="border-b border-line">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-[18px] text-left text-[15px] text-ink"
            >
              {item.q}
              <Plus className={cn('h-[18px] w-[18px] flex-none text-ink-faint transition-transform', isOpen && 'rotate-45')} aria-hidden />
            </button>
            {isOpen && <p className="-mt-1 pb-5 text-[14px] leading-relaxed text-ink-muted">{item.a}</p>}
          </div>
        )
      })}
    </div>
  )
}
