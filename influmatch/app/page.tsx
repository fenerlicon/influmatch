import { redirect } from 'next/navigation'
import Hero from '@/components/landing/Hero'
import Spotlight from '@/components/landing/Spotlight'
import ValueProposition from '@/components/landing/ValueProposition'
import BadgesSection from '@/components/landing/BadgesSection'

interface HomeProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Home({ searchParams }: HomeProps) {
  // Check for error parameters from Supabase email verification
  const error = typeof searchParams.error === 'string' ? searchParams.error : null
  const errorCode = typeof searchParams.error_code === 'string' ? searchParams.error_code : null
  
  // If there's an error (like otp_expired), redirect to login with error message
  if (error || errorCode) {
    let errorMessage = 'verification_failed'
    if (errorCode === 'otp_expired') {
      errorMessage = 'email_link_expired'
    } else if (error === 'access_denied') {
      errorMessage = 'verification_denied'
    }
    redirect(`/login?error=${errorMessage}`)
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grid-overlay" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-soft-gold/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-80 h-72 w-72 -translate-x-1/2 rounded-full bg-[#1F2030]/80 blur-[140px]"
      />

      <div className="relative">
        <Hero />
        <Spotlight />
        <ValueProposition />
        <BadgesSection />
      </div>
    </main>
  )
}
