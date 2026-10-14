import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import type { DiscoverInfluencer } from '@/types/influencer'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import FavoritesLockedCard from '@/components/dashboard/FavoritesLockedCard'
import BrandDiscoverHeader from '@/components/discover/BrandDiscoverHeader'
import DiscoverGrid from '@/components/discover/DiscoverGrid'
import ListsManager from '@/components/discover/ListsManager'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { areFavoritesLocked } from '@/lib/favorites'
import { visibleMinPrices } from '@/lib/rate-card'
import { completedCollaborationCounts } from '@/lib/collaborations'

export const revalidate = 0

/** Keşfet > Favoriler ve Listeler. */
export default async function BrandFavoritesPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('verification_status, spotlight_active, spotlight_expires_at, spotlight_plan')
    .eq('id', user.id)
    .single()

  const verificationStatus = (userData?.verification_status ?? 'pending') as 'pending' | 'verified' | 'rejected'
  if (verificationStatus !== 'verified') return <BrandLockScreen status={verificationStatus} />

  // Ücretsiz markada (sınırlar açıkken) favoriler ve listeler kilitli; kayıtlar silinmez, yalnızca gizlenir.
  if (await areFavoritesLocked(user.id)) {
    return (
      <div>
        <BrandDiscoverHeader tab="favorites" />
        <FavoritesLockedCard />
      </div>
    )
  }

  const [{ data: favorites }, { data: userLists }] = await Promise.all([
    supabase.from('favorites').select('influencer_id').eq('brand_id', user.id),
    supabase.from('favorite_lists').select('id, name').eq('brand_id', user.id).order('created_at', { ascending: false }),
  ])
  const favoritedIds = favorites?.map((f) => f.influencer_id) ?? []

  let influencers: DiscoverInfluencer[] = []
  if (favoritedIds.length > 0) influencers = await getEnrichedInfluencers({ ids: favoritedIds })
  const ids = influencers.map((i) => i.id)
  const [minPrices, counts] = await Promise.all([visibleMinPrices(supabase, ids), completedCollaborationCounts(supabase, ids)])
  const isSpotlight = hasActiveSpotlight(userData)

  return (
    <div>
      <BrandDiscoverHeader tab="favorites" counts={{ favorites: favoritedIds.length }} />
      <ListsManager initialLists={(userLists ?? []) as { id: string; name: string }[]} />
      <DiscoverGrid
        viewerRole="brand"
        influencers={influencers}
        favoritedIds={favoritedIds}
        isSpotlightMember={isSpotlight}
        spotlightPlan={isSpotlight ? (userData?.spotlight_plan ?? null) : null}
        minPrices={minPrices}
        completedCounts={Object.fromEntries(counts)}
        emptyTitle="Henüz favorin yok"
        emptyDescription="Tümü sekmesindeki kartlarda kalbe dokunarak profilleri buraya ekleyebilirsin."
      />
    </div>
  )
}
