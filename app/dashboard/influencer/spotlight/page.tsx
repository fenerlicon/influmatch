import Image from 'next/image'
import { redirect } from 'next/navigation'
import { BadgeDollarSign, Eye, MousePointerClick, Star } from 'lucide-react'
import SpotlightToggleCard from '@/components/dashboard/SpotlightToggleCard'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getCategoryLabel } from '@/utils/categories'

const advantages = [
  { icon: Eye, title: '4x Daha Fazla Görüntülenme', description: 'Spotlight vitrininde öne çık, aktif markaların radarına gir.' },
  { icon: MousePointerClick, title: 'Öncelikli Listeleme', description: 'Keşfet sayfasında premium rozetiyle gösteril, teklif ihtimalini artır.' },
  { icon: Star, title: 'Marka Güveni', description: 'Altın çerçeve ve rozetle profilin doğrulanmış görünür.' },
]

const mockStats = [
  { icon: Eye, label: 'Profil Görüntülenme', value: '1.2k', badge: '+%15' },
  { icon: MousePointerClick, label: 'Teklif Oranı', value: '%4.8', badge: 'click' },
  { icon: Star, label: 'Vitrin Puanı', value: '9.5', badge: '⭐' },
]

export const revalidate = 0

export default async function InfluencerSpotlightPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('spotlight_active, avatar_url, full_name, username, category, verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[InfluencerSpotlightPage] profile load error', error.message)
  }

  const spotlightActive = profile?.spotlight_active ?? false
  const verificationStatus = profile?.verification_status ?? 'pending'
  const displayName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Influencer'
  const username = profile?.username ?? user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'profil'
  const category = profile?.category ?? 'lifestyle'
  const avatarUrl =
    profile?.avatar_url ??
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80'

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Spotlight</p>
        <h1 className="mt-2 text-3xl font-semibold">Spotlight Vitrini</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-300">
          Vitrin görünürlüğü tüm influencerlara açık. Spotlight Premium ise öne çıkan rozetlerle markaların öneri listesinde
          üst sıralara çıkmanı sağlayan ücretli paket.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <SpotlightToggleCard 
            initialActive={spotlightActive} 
            verificationStatus={verificationStatus}
          />

          <div className="rounded-3xl border border-white/10 bg-[#0F1014] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Vitrin Avantajları</p>
            <div className="mt-4 space-y-4">
              {advantages.map((item) => (
                <div key={item.title} className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 text-gray-200">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-soft-gold/40 bg-soft-gold/10 text-soft-gold">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-soft-gold/30 bg-gradient-to-br from-[#11121A] to-[#0B0C10] p-6 text-white shadow-[0_0_35px_rgba(212,175,55,0.35)]">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Markalar Seni Böyle Görüyor</p>
            <h2 className="mt-2 text-2xl font-semibold">Spotlight Önizlemesi</h2>
          </div>
          <div className="grid gap-4">
            <article className="rounded-3xl border border-purple-500/50 bg-[#0B0C10]/80 p-5 text-white transition hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]">
              <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-purple-500/60">
                <Image src={avatarUrl} alt={displayName} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              </div>
              <div className="mt-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{displayName}</p>
                  <p className="text-sm text-gray-400">@{username}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-gray-300">
                  {getCategoryLabel(category)}
                </span>
              </div>
              <p className="mt-4 text-sm text-gray-300">
                Discover kartının premium görünümü, mor çerçeve ve glow efekti ile markaların dikkatini çeker.
              </p>
            </article>

            <div
              className={`rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-sm text-gray-300 ${
                spotlightActive ? '' : 'border-dashed'
              }`}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-400">Spotlight süresi</p>
                  <p className="text-lg font-semibold text-white">30 gün</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Kategori</p>
                  <p className="text-lg font-semibold text-white">{getCategoryLabel(category)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Durum</p>
                  <p className="text-lg font-semibold text-white">{spotlightActive ? 'Aktif' : 'Pasif'}</p>
                </div>
              </div>
              <p className="mt-3 text-gray-400">
                {spotlightActive
                  ? 'Spotlight, keşfet sayfasında seni en üst sıralara taşıyan premium vitrindir.'
                  : 'Spotlight aktif değil. Aşağıdaki paket bölümünden satın alarak aktive edebilirsin.'}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-[#0B0C10]/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Standart kart</p>
                <div className="relative mt-3 h-40 w-full overflow-hidden rounded-2xl border border-white/10">
                  <Image src={avatarUrl} alt={`${displayName} standart`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                </div>
              </div>
              <div className="rounded-3xl border border-purple-500/40 bg-[#0B0C10]/80 p-4 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                <p className="text-xs uppercase tracking-[0.3em] text-purple-400">Spotlight kart</p>
                <div className="relative mt-3 h-40 w-full overflow-hidden rounded-2xl border border-purple-500/70">
                  <Image src={avatarUrl} alt={`${displayName} spotlight`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Vitrin İstatistikleri</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Performansını takip et</h3>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {mockStats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0F1014] p-4 text-gray-300">
              <div className="flex items-center gap-2 text-soft-gold">
                <stat.icon className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.3em]">{stat.label}</p>
              </div>
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
              <p className="text-xs text-soft-gold">{stat.badge}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#0F1014] p-5 text-white">
            <div className="flex items-center justify-between" id="spotlight-purchase">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Spotlight Paketi</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Premium vitrin görünürlüğü</h3>
                <p className="mt-2 text-sm text-gray-400">Keşfet algoritmasında öncelik, mor çerçeve ve marka öneri boost'u.</p>
              </div>
              <BadgeDollarSign className="h-10 w-10 text-soft-gold" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-4xl font-semibold text-soft-gold">Çok Yakında</p>
              <span className="text-sm text-gray-400">/ 30 gün</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-gray-300">
              <li>• Mor çerçeve & Spotlight etiketi</li>
              <li>• Keşfet listelerinde +%40 görünürlük</li>
              <li>• Marka öneri algoritmasında öncelik</li>
            </ul>
            <button className="mt-5 w-full rounded-2xl border border-soft-gold/40 bg-soft-gold/10 px-4 py-3 text-sm font-semibold text-soft-gold">
              Manuel Satın Alma Talebi Gönder
            </button>
            <p className="mt-2 text-xs text-gray-400">MVP aşamasında manuel onay ile aktive edilecek.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0F1014] p-5 text-gray-300">
            <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Bilgilendirme</p>
            <p className="mt-2 text-sm text-gray-400">
              Spotlight satın alımında fatura bilgilerin mail üzerinden doğrulanır. MVP döneminde ödeme işlemleri manuel olarak alınır ve
              24 saat içinde hesabın Spotlight’a taşınır.
            </p>
            <p className="mt-4 text-sm text-gray-400">Soru ve talepler için: spotlight@influmatch.net</p>
          </div>
        </div>
      </section>
    </div>
  )
}


