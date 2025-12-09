import { createSupabaseServerClient } from '@/utils/supabase/server'
import BrandDiscoverGrid from '@/components/dashboard/BrandDiscoverGrid'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import { getListItems } from '@/app/actions/favoriteLists'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Layers } from 'lucide-react'

export const revalidate = 0

interface InflistDetailsPageProps {
    params: {
        id: string
    }
}

export default async function InflistDetailsPage({ params }: InflistDetailsPageProps) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 1. Get List Details
    const { data: list, error: listError } = await supabase
        .from('favorite_lists')
        .select('name, id')
        .eq('id', params.id)
        .eq('brand_id', user.id)
        .single()

    if (listError || !list) {
        redirect('/dashboard/brand')
    }

    // 2. Get List Items
    const influencerIds = await getListItems(list.id)

    // 2.5 Get Global Favorites for Heart Icon
    const { data: globalFavs } = await supabase
        .from('favorites')
        .select('influencer_id')
        .eq('brand_id', user.id)
    const favoritedIds = globalFavs?.map((f: any) => f.influencer_id) || []

    // 3. Fetch Influencer Data
    let influencers: any[] = []
    if (influencerIds.length > 0) {
        influencers = await getEnrichedInfluencers({ ids: influencerIds })
        // Sort by added order? getListItems returns list, but getEnriched removes order usually.
        // We can sort manually if needed, but for now default sort is fine.
    }

    return (
        <div className="space-y-6">
            <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
                <Link href="/dashboard/brand" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Panele Dön
                </Link>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
                        <Layers className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">Özel Liste</p>
                        <h1 className="text-2xl font-semibold">{list.name}</h1>
                    </div>
                </div>
                <p className="mt-2 text-gray-300 max-w-2xl pl-[60px]">
                    Bu listedeki influencerları aşağıda görüntüleyebilirsiniz.
                </p>
            </header>

            {influencers.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 py-20 text-center">
                    <h3 className="text-xl font-medium text-white">Bu liste henüz boş</h3>
                    <p className="mt-2 max-w-md text-gray-400">
                        Keşfet sayfasından influencerları bu listeye ekleyebilirsiniz.
                    </p>
                    <a href="/dashboard/brand/discover" className="mt-6 rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600">
                        Keşfet'e Git
                    </a>
                </div>
            ) : (
                <BrandDiscoverGrid
                    influencers={influencers}
                    initialFavoritedIds={favoritedIds}
                    userRole="brand"
                />
            )}
        </div>
    )
}
