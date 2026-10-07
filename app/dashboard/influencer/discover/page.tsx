import Link from 'next/link'
import { redirect } from 'next/navigation'
import BrandDiscoverGrid from '@/components/dashboard/BrandDiscoverGrid'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import { hasActiveSpotlight } from '@/lib/spotlight-access'

export default async function InfluencerDiscoverPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Kendi Spotlight durumu (süresi dolmuşsa PRO filtreleri açılmaz) ve doğrulanmış hesap durumu
  const [{ data: currentUserData }, { data: verifiedAccounts }] = await Promise.all([
    supabase
      .from('users')
      .select('spotlight_active, spotlight_plan, spotlight_expires_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_verified', true)
      .limit(1),
  ])

  // Keşif listesi yalnızca doğrulanmış sosyal hesabı olanları gösterir; banner da aynı kurala bakar.
  const hasConnectedAccounts = (verifiedAccounts?.length ?? 0) > 0
  const isSpotlight = hasActiveSpotlight(currentUserData)

  // Marka keşfiyle aynı kaynak: yalnızca doğrulanmış hesapların istatistikleri, seçilen rozetler.
  const influencers = await getEnrichedInfluencers()

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Vitrin</p>
        <h1 className="mt-2 text-2xl font-semibold">Topluluğu keşfet</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-300">
          Diğer influencer profillerini incele, Spotlight vitrininde nasıl göründüğünü karşılaştır ve profilini optimize
          etmek için ilham al.
        </p>
      </header>

      {!hasConnectedAccounts && (
        <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-white shadow-glow flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-500/20 text-yellow-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-yellow-500">Vitrinde Görünmüyorsun</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Hiçbir resmi hesabını bağlamadığın için bu vitrinde (keşfet sayfasında) diğer markalara listelenmiyorsun. Lütfen önce bir sosyal medya hesabı bağla.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/influencer#verification-section"
            className="shrink-0 rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 transition"
          >
            Hesap Bağla
          </Link>
        </div>
      )}

      <BrandDiscoverGrid
        influencers={influencers}
        currentUserId={user.id}
        userRole="influencer"
        isSpotlightMember={isSpotlight}
        spotlightPlan={isSpotlight ? (currentUserData?.spotlight_plan ?? null) : null}
      />
    </div>
  )
}
