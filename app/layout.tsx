import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import AuthProvider from '@/components/providers/AuthProvider'
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Influmatch | Ücretsiz Influencer Bulma Platformu & Arama Motoru',
  description: "Türkiye'nin en şeffaf ücretsiz influencer bulma platformu. Markanız için en uygun Instagram ve TikTok içerik üreticilerini, UGC kreatörlerini ücretsiz keşfedin, doğrudan iletişime geçin.",
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
  'url': 'https://influmatch.com',
  'logo': 'https://influmatch.com/icon.png',
  'description': 'Türkiye\'nin en şeffaf ücretsiz influencer bulma platformu ve arama motoru. Markalar ve influencerlar ajanssız doğrudan buluşur.',
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
    <html lang="tr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  )
}

