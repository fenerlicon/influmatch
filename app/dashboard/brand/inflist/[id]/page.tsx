import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import { getListItems } from '@/app/actions/favoriteLists'
import type { DiscoverInfluencer } from '@/types/influencer'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import DiscoverGrid from '@/components/discover/DiscoverGrid'
import { ButtonLink, PageHeader } from '@/components/ui'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { areFavoritesLocked } from '@/lib/favorites'
import { visibleMinPrices } from '@/lib/rate-card'
import { completedCollaborationCounts } from '@/lib/collaborations'

export const revalidate = 0

export default async function InflistDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('verification_status, spotlight_active, spotlight_expires_at, spotlight_plan')
    .eq('id', user.id)
    .single()

  const verificationStatus = (userData?.verification_status ?? 'pending') as 'pending' | 'verified' | 'rejected'
  if (verificationStatus !== 'verified') return <BrandLockScreen status={verificationStatus} />

  // Ücretsiz markada (sınırlar açıkken) listeler kilitli: favoriler sekmesi açıklama kartını gösterir.
  if (await areFavoritesLocked(user.id)) redirect('/dashboard/brand/favorites')

  const { data: list } = await supabase.from('favorite_lists').select('name, id').eq('id', params.id).eq('brand_id', user.id).maybeSingle()
  if (!list) redirect('/dashboard/brand/favorites')

  const [influencerIds, { data: favorites }] = await Promise.all([
    getListItems(list.id),
    supabase.from('favorites').select('influencer_id').eq('brand_id', user.id),
  ])

  let influencers: DiscoverInfluencer[] = []
  if (influencerIds.length > 0) influencers = await getEnrichedInfluencers({ ids: influencerIds })
  const ids = influencers.map((i) => i.id)
  const [minPrices, counts] = await Promise.all([visibleMinPrices(supabase, ids), completedCollaborationCounts(supabase, ids)])
  const isSpotlight = hasActiveSpotlight(userData)

  return (
    <div>
      <PageHeader
        title={list.name}
        description={`Liste · ${influencerIds.length} profil`}
        actions={
          <ButtonLink href="/dashboard/brand/favorites" variant="ghost" leftIcon={<ArrowLeft />}>
            Favoriler ve listeler
          </ButtonLink>
        }
      />
      <DiscoverGrid
        viewerRole="brand"
        influencers={influencers}
        favoritedIds={(favorites ?? []).map((f) => f.influencer_id)}
        isSpotlightMember={isSpotlight}
        spotlightPlan={isSpotlight ? (userData?.spotlight_plan ?? null) : null}
        minPrices={minPrices}
        completedCounts={Object.fromEntries(counts)}
        emptyTitle="Bu liste boş"
        emptyDescription="Keşfet'teki kartlarda liste düğmesiyle profil ekleyebilirsin."
      />
    </div>
  )
}
