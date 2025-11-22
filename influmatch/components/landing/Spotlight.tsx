'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface SpotlightInfluencer {
  id: string
  name: string
  username: string
  category: string
  city: string
  followers: string
  engagement: string
  badges: string[]
  avatarUrl: string
}

const mockInfluencers: SpotlightInfluencer[] = [
  {
    id: '1',
    name: 'Ayşe Yılmaz',
    username: '@ayseyilmaz',
    category: 'Güzellik',
    city: 'İstanbul',
    followers: '420K',
    engagement: '%4.8',
    badges: ['Vitrin Aktif', 'Premium'],
    avatarUrl:
      'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=600&q=60',
  },
  {
    id: '2',
    name: 'Mehmet Demir',
    username: '@mehmetdemir',
    category: 'Moda',
    city: 'İzmir',
    followers: '310K',
    engagement: '%5.2',
    badges: ['Trend', 'Moda'],
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=60',
  },
  {
    id: '3',
    name: 'Zeynep Kaya',
    username: '@zeynepkaya',
    category: 'Yaşam Tarzı',
    city: 'Ankara',
    followers: '210K',
    engagement: '%4.1',
    badges: ['Lifestyle', 'Spotlight'],
    avatarUrl:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=60',
  },
  {
    id: '4',
    name: 'Can Özkan',
    username: '@canozkan',
    category: 'Güzellik',
    city: 'Bursa',
    followers: '190K',
    engagement: '%4.5',
    badges: ['Erkek Bakımı', 'Vitrin'],
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=60',
  },
]

export default function Spotlight() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(
      () => setCurrentIndex((prev) => (prev + 1) % mockInfluencers.length),
      3500,
    )
    return () => clearInterval(interval)
  }, [])

  return (
    <section
      id="spotlight"
      className="relative px-6 py-20 md:px-12 lg:px-24 xl:px-32"
    >
      <div className="absolute inset-0 -z-10 rounded-[48px] bg-gradient-to-b from-white/5 via-transparent to-transparent blur-3xl" />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-soft-gold/80">
              Spotlight
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
              <span className="text-soft-gold">Öne Çıkan</span> influencer
              vitrinimiz
            </h2>
            <p className="mt-3 max-w-2xl text-base text-gray-300">
              Markalar için hazır vitrin: kategori, şehir ve vitrin durumuna göre
              filtrelenmiş profiller gerçek zamanlı olarak öne çıkar.
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-soft-gold/60 hover:text-soft-gold md:w-auto"
          >
            Tümünü Gör
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {mockInfluencers.map((influencer, index) => {
            const isActive = index === currentIndex
            const profileSlug = influencer.username.replace('@', '')

            return (
              <Link
                key={influencer.id}
                href={`/profile/${profileSlug}`}
                className={`group relative rounded-3xl border border-white/5 bg-white/5 p-5 transition duration-300 hover:border-soft-gold/60 hover:bg-white/10 ${
                  isActive ? 'ring-2 ring-soft-gold/60' : 'opacity-90'
                }`}
              >
                <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-black/30">
                  <Image
                    src={influencer.avatarUrl}
                    alt={influencer.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 45vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  {isActive && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-soft-gold">
                      Anlık Vitrin
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {influencer.name}
                    </p>
                    <p className="text-sm text-soft-gold">
                      {influencer.username}
                    </p>
                  </div>
                  <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-gray-300">
                    {influencer.category}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {influencer.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-gray-300"
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                  <span>{influencer.city}</span>
                  <span>{influencer.followers} takipçi</span>
                </div>

                <div className="mt-3 rounded-2xl bg-black/30 px-4 py-3 text-xs text-gray-300">
                  <div className="flex items-center justify-between">
                    <span>Etkileşim Oranı</span>
                    <span className="font-semibold text-soft-gold">
                      {influencer.engagement}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

