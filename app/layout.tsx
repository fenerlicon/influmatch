import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { SpeedInsights } from '@vercel/speed-insights/next'
import AuthProvider from '@/components/providers/AuthProvider'
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Influmatch',
  description: 'Influencer ve Markaları Buluşturan Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors />
          <SpeedInsights />
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
