import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getAIRecommendations } from '@/utils/fetchInfluencers'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import BrandDiscoverHeader from '@/components/discover/BrandDiscoverHeader'
import DiscoverGrid from '@/components/discover/DiscoverGrid'
import { ButtonLink, Card, EmptyState } from '@/components/ui'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { brandCategoryLabel } from '@/lib/category-map'
import { visibleMinPrices } from '@/lib/rate-card'
import { completedCollaborationCounts } from '@/lib/collaborations'
import { areFavoritesLocked } from '@/lib/favorites'

export const revalidate = 0

/** Keşfet > Önerilenler: marka sektörüne göre puanlanan profiller (Spotlight özelliği). */
export default async function AIRecommendationsPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('category, spotlight_active, spotlight_expires_at, spotlight_plan, verification_status')
    .eq('id', user.id)
    .single()

  const verificationStatus = (profile?.verification_status ?? 'pending') as 'pending' | 'verified' | 'rejected'
  if (verificationStatus !== 'verified') return <BrandLockScreen status={verificationStatus} />

  // Öneriler Spotlight özelliğidir; plan yoksa hesaplanmaz, sekme açıklama gösterir.
  if (!hasActiveSpotlight(profile)) {
    return (
      <div>
        <BrandDiscoverHeader tab="recommended" />
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Önerilenler Spotlight markalara açık"
            description="Sektörüne uyan kategorilerdeki profiller kategori uyumu, etkileşim ve doğrulama durumuna göre puanlanıp sıralanır."
            action={
              <ButtonLink href="/dashboard/spotlight/brand" variant="primary" size="sm">
                Spotlight&apos;ı incele
              </ButtonLink>
            }
          />
        </Card>
      </div>
    )
  }

  const category = profile?.category
  const recommendations = await getAIRecommendations(user.id, category)
  const ids = recommendations.map((r) => r.id)
  const favoritesLocked = await areFavoritesLocked(user.id)
  const [minPrices, counts, { data: favorites }] = await Promise.all([
    visibleMinPrices(supabase, ids),
    completedCollaborationCounts(supabase, ids),
    favoritesLocked ? Promise.resolve({ data: [] as { influencer_id: string }[] }) : supabase.from('favorites').select('influencer_id').eq('brand_id', user.id),
  ])

  return (
    <div>
      <BrandDiscoverHeader tab="recommended" counts={{ recommended: recommendations.length }} />
      <p className="-mt-1 mb-4 text-[13px] text-ink-muted">
        {brandCategoryLabel(category) || 'Sektörün'} ile ilişkili kategorilerdeki profiller kategori uyumu, etkileşim ve doğrulama durumuna göre
        100 üzerinden puanlandı.
      </p>
      <DiscoverGrid
        viewerRole="brand"
        scored
        influencers={recommendations}
        favoritedIds={(favorites ?? []).map((f) => f.influencer_id)}
        favoritesLocked={favoritesLocked}
        isSpotlightMember
        spotlightPlan={profile?.spotlight_plan ?? null}
        minPrices={minPrices}
        completedCounts={Object.fromEntries(counts)}
        emptyTitle="Henüz eşleşme yok"
        emptyDescription="Sektörün için şu an uygun profil bulunamadı. Sektörünü Ayarlar'dan güncelleyebilirsin."
      />
    </div>
  )
}
