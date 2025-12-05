import { createSupabaseServerClient } from '@/utils/supabase/server'
import BrandDiscoverGrid from '@/components/dashboard/BrandDiscoverGrid'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'

export const revalidate = 0

export default async function BrandDiscoverPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const influencers = await getEnrichedInfluencers()

  // 4. Fetch Favorites
  const { data: favorites } = await supabase
    .from('favorites')
    .select('influencer_id')
    .eq('brand_id', user.id)

  // ...
  const favoritedIds = new Set(favorites?.map((f: { influencer_id: string }) => f.influencer_id) || [])

  const userRole = user.user_metadata?.role || 'brand' // fallback or fetch from DB if metadata is unreliable

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

      <BrandDiscoverGrid influencers={influencers} initialFavoritedIds={Array.from(favoritedIds) as string[]} userRole={userRole} />
    </div>
  )
}
