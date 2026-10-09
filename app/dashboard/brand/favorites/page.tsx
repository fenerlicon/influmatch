import { createSupabaseServerClient } from '@/utils/supabase/server'
import BrandDiscoverGrid from '@/components/dashboard/BrandDiscoverGrid'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import type { DiscoverInfluencer } from '@/types/influencer'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import InflistManager from '@/components/dashboard/InflistManager'
import FavoritesLockedCard from '@/components/dashboard/FavoritesLockedCard'
import { areFavoritesLocked } from '@/lib/favorites'

export const revalidate = 0

export default async function BrandFavoritesPage() {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Fetch user profile verification status
    const { data: userData } = await supabase
        .from('users')
        .select('verification_status, spotlight_active, spotlight_expires_at, spotlight_plan')
        .eq('id', user.id)
        .single()

    const verificationStatus = (userData?.verification_status ?? 'pending') as 'pending' | 'verified' | 'rejected'
    if (verificationStatus !== 'verified') {
        return <BrandLockScreen status={verificationStatus} />
    }

    const header = (
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Favoriler</p>
            <h1 className="mt-2 text-2xl font-semibold">Favoriler ve Listeler</h1>
            <p className="mt-2 text-gray-300 max-w-2xl">
                Favorilerinize eklediğiniz profilleri inceleyebilir, isimli listelere ayırabilirsiniz.
            </p>
        </header>
    )

    // Ücretsiz markada (sınırlar açıkken) favoriler ve listeler kilitli; kayıtlar silinmez, yalnızca gizlenir.
    if (await areFavoritesLocked(user.id)) {
        return (
            <div className="space-y-6">
                {header}
                <FavoritesLockedCard />
            </div>
        )
    }

    // 1. Fetch Favorite IDs
    const { data: favorites } = await supabase
        .from('favorites')
        .select('influencer_id')
        .eq('brand_id', user.id)

    const favoritedIds = favorites?.map((f) => f.influencer_id) || []

    // Favorilerin ayrıldığı listeler aynı sayfada yönetilir.
    const { data: userLists } = await supabase
        .from('favorite_lists')
        .select('id, name')
        .eq('brand_id', user.id)
        .order('created_at', { ascending: false })

    // 2. Fetch Influencer Data
    let influencers: DiscoverInfluencer[] = []
    if (favoritedIds.length > 0) {
        influencers = await getEnrichedInfluencers({ ids: favoritedIds })
    }

    return (
        <div className="space-y-6">
            {header}

            <InflistManager initialLists={(userLists ?? []) as { id: string; name: string }[]} />

            {influencers.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 py-20 text-center">
                    <h3 className="text-xl font-medium text-white">Henüz favori influencerınız yok</h3>
                    <p className="mt-2 max-w-md text-gray-400">
                        Keşfet sayfasından influencerları inceleyerek favorilerinize ekleyebilirsiniz.
                    </p>
                    <a href="/dashboard/brand/discover" className="mt-6 rounded-full bg-soft-gold px-6 py-2 text-sm font-semibold text-black transition hover:bg-white">
                        Keşfet'e Git
                    </a>
                </div>
            ) : (
                <BrandDiscoverGrid
                    influencers={influencers}
                    initialFavoritedIds={favoritedIds}
                    userRole="brand" // Enable filters
                    isSpotlightMember={hasActiveSpotlight(userData)}
                    spotlightPlan={hasActiveSpotlight(userData) ? (userData?.spotlight_plan ?? null) : null}
                />
            )}
        </div>
    )
}
