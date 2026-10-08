import { createSupabaseServerClient } from '@/utils/supabase/server'
import BrandDiscoverGrid from '@/components/dashboard/BrandDiscoverGrid'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { visibleMinPrices } from '@/lib/rate-card'
import { completedCollaborationCounts } from '@/lib/collaborations'

export const revalidate = 0

export default async function BrandDiscoverPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get user profile for spotlight status & verification status
  const { data: userData } = await supabase
    .from('users')
    .select('spotlight_active, spotlight_plan, spotlight_expires_at, category, verification_status')
    .eq('id', user.id)
    .single()

  const verificationStatus = (userData?.verification_status ?? 'pending') as 'pending' | 'verified' | 'rejected'
  if (verificationStatus !== 'verified') {
    return <BrandLockScreen status={verificationStatus} />
  }

  const influencers = await getEnrichedInfluencers()
  const influencerIds = influencers.map((influencer) => influencer.id)
  // Fiyatlar markanın kendi istemcisiyle okunur: RLS yalnızca doğrulanmış markaya satır döndürür.
  const [minPrices, counts] = await Promise.all([
    visibleMinPrices(supabase, influencerIds),
    completedCollaborationCounts(supabase, influencerIds),
  ])

  // 4. Fetch Favorites
  const { data: favorites } = await supabase
    .from('favorites')
    .select('influencer_id')
    .eq('brand_id', user.id)

  // ...
  const favoritedIds = new Set(favorites?.map((f: { influencer_id: string }) => f.influencer_id) || [])

  const userRole = 'brand' // marka layout'u DB rolünü zaten doğruladı
  // Süresi dolmuş Spotlight PRO filtrelerini açmasın.
  const isSpotlight = hasActiveSpotlight(userData)

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Keşfet</p>
        <h1 className="mt-2 text-2xl font-semibold">İlham veren influencer setleri</h1>
        <p className="mt-2 text-gray-300 max-w-2xl">
          Kategoriye göre filtrele, Spotlight rozetine sahip profilleri öne çıkar ve marka hikâyene en uygun
          eşleştirmeyi oluştur.
        </p>
      </header>

      <BrandDiscoverGrid
        influencers={influencers}
        initialFavoritedIds={Array.from(favoritedIds) as string[]}
        userRole={userRole}
        isSpotlightMember={isSpotlight}
        spotlightPlan={isSpotlight ? (userData?.spotlight_plan ?? null) : null}
        defaultCategory={userData?.category}
        minPrices={minPrices}
        completedCounts={Object.fromEntries(counts)}
      />
    </div>
  )
}
