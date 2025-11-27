import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import SupabaseProvider from '@/components/providers/SupabaseProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Influmatch - Doğrudan İşbirliği Platformu',
  description: 'Markalar ve Influencer\'ların ajans olmadan doğrudan bir araya geldiği platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className={`${inter.className} bg-background text-white antialiased`}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  )
}

