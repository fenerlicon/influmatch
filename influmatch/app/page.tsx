import Hero from '@/components/landing/Hero'
import Spotlight from '@/components/landing/Spotlight'
import ValueProposition from '@/components/landing/ValueProposition'

export default function Home() {
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
      </div>
    </main>
  )
}

