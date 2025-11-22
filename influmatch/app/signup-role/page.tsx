'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { UserRole } from '@/types/auth'

const ROLE_CARDS: Array<{
  role: UserRole
  title: string
  description: string
  highlights: string[]
}> = [
  {
    role: 'influencer',
    title: 'Influencerım',
    description: 'Profilini öne çıkar, teklifleri tek panelden yönet.',
    highlights: ['Spotlight vitrin', 'Gelen teklifler', 'Vitrin yönetimi'],
  },
  {
    role: 'brand',
    title: 'Markayım',
    description: 'Kategori bazlı keşfet, güvenli teklif gönder.',
    highlights: ['Discover grid', 'Teklif akışı', 'Bütçe yönetimi'],
  },
]

export default function SignupRolePage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole>('influencer')

  const handleContinue = () => {
    router.push(`/signup?role=${selectedRole}`)
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Rol Seçimi</p>
          <h1 className="mt-5 text-4xl font-semibold text-white">Seni nasıl tanıyalım?</h1>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            Hemen Başla dediğinde ilk adım rolünü seçmek. Seçiminden sonra kayıt formunda rol bilgini
            Supabase metadata&apos;sına otomatik olarak işleyeceğiz.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {ROLE_CARDS.map((card) => {
            const isSelected = selectedRole === card.role
            return (
              <button
                key={card.role}
                type="button"
                onClick={() => setSelectedRole(card.role)}
                className={`glass-panel flex h-full flex-col rounded-3xl p-8 text-left transition hover:border-soft-gold/60 hover:bg-white/10 ${
                  isSelected ? 'ring-2 ring-soft-gold/70' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-soft-gold/80">Rol</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{card.title}</h2>
                  </div>
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                      isSelected ? 'border-soft-gold bg-soft-gold text-background' : 'border-white/20 text-white'
                    }`}
                  >
                    {isSelected ? '✓' : ''}
                  </span>
                </div>
                <p className="mt-4 text-sm text-gray-300">{card.description}</p>
                <ul className="mt-6 space-y-3 text-sm text-gray-200">
                  {card.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-soft-gold" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <div className="text-center">
          <p className="text-gray-300">Seçilen rol: {selectedRole === 'brand' ? 'Markayım' : 'Influencerım'}</p>
          <button
            onClick={handleContinue}
            className="mt-6 w-full rounded-full bg-soft-gold px-10 py-4 text-base font-semibold text-background transition hover:bg-champagne hover:text-background md:w-auto"
          >
            Devam Et
          </button>
        </div>
      </div>
    </main>
  )
}

