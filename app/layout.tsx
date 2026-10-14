import './globals.css'
import { Instrument_Serif } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { Toaster } from 'sonner'
import CookieConsent from '@/components/consent/CookieConsent'
import AuthProvider from '@/components/providers/AuthProvider'

// Başlık yazı tipi; arayüz Geist (tailwind font-sans / font-display)
const display = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata = {
  title: 'Influmatch | Ücretsiz Influencer Bulma Platformu & Arama Motoru',
  description: "Ücretsiz influencer bulma platformu. Markanız için uygun Instagram ve TikTok içerik üreticilerini, UGC kreatörlerini ücretsiz keşfedin, teklif gönderin.",
  keywords: [
    'influencer bulma platformu',
    'ücretsiz influencer arama',
    'ugc içerik üreticisi bul',
    'influencer arama motoru',
    'influencer marketing platformu',
    'türkiye influencer platformu',
    'sosyal medya işbirliği',
    'reklam işbirliği platformu',
    'istanbul influencer',
    'ankara influencer',
    'izmir influencer'
  ],
  other: {
    'geo.region': 'TR',
    'geo.placename': 'Turkey',
    'geo.position': '38.963745;35.243322', // Türkiye genel koordinatları
    'ICBM': '38.963745, 35.243322',
  }
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  'name': 'Influmatch',
  'url': 'https://influmatch.net',
  'logo': 'https://influmatch.net/icon.png',
  'description': 'Ücretsiz influencer bulma platformu ve arama motoru. Markalar ve influencerlar ajanssız doğrudan buluşur.',
  'address': {
    '@type': 'PostalAddress',
    'addressCountry': 'TR'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={`${GeistSans.variable} ${display.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans">
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors />
          {/* Çerez tercihi; Speed Insights yalnızca onaydan sonra yüklenir */}
          <CookieConsent />
        </AuthProvider>
      </body>
    </html>
  )
}

