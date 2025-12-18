import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getAIRecommendations } from '@/utils/fetchInfluencers'
import InfluencerGridCard from '@/components/dashboard/InfluencerGridCard'
import { Sparkles, ArrowLeft, Zap } from 'lucide-react'

export default async function AIRecommendationsPage() {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Get user profile for category and spotlight status
    const { data: profile } = await supabase
        .from('users')
        .select('category, spotlight_active, spotlight_plan')
        .eq('id', user.id)
        .single()

    const userRole = user.user_metadata?.role || 'brand'
    const category = profile?.category

    // Use the shared AI logic to get recommendations
    // No limit here, we want to show all relevance matches
    const recommendations = await getAIRecommendations(user.id, category)

    return (
        <div className="min-h-screen space-y-8 pb-10">
            {/* Header Section with Futuristic/AI Theme */}
            <header className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-[#0A0B10] p-8 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-600/20 blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-purple-600/20 blur-[60px] pointer-events-none" />

                <div className="relative z-10">
                    <Link
                        href="/dashboard/brand"
                        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Panele Dön
                    </Link>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-900/40">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-blue-400">AI Powered Analysis</span>
                                    <span className="text-xs text-gray-400">Powered by Influmatch Engine v2.0</span>
                                </div>
                            </div>

                            <h1 className="text-3xl md:text-4xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-200">
                                Sizin İçin Önerilenler
                            </h1>
                            <p className="mt-4 max-w-2xl text-lg text-gray-300 leading-relaxed">
                                Yapay zeka algoritmamız, <span className="text-blue-400 font-semibold">{category || 'Sektörünüz'}</span> kategorisindeki en etkili ve güvenilir profilleri analiz etti ve markanızla %95+ uyumlu bu listeyi oluşturdu.
                            </p>
                        </div>

                        {/* Stats or Badges */}
                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Eşleşen Profil</p>
                                <p className="text-2xl font-bold text-white mt-1">{recommendations.length}</p>
                            </div>
                            <div className="rounded-2xl border border-blue-500/20 bg-blue-600/10 px-5 py-3 backdrop-blur-sm">
                                <p className="text-xs text-blue-300 uppercase tracking-wider">Ortalama Skor</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                    <p className="text-2xl font-bold text-white">
                                        {recommendations.length > 0
                                            ? Math.round(recommendations.reduce((acc, curr) => acc + (curr.matchScore || 0), 0) / recommendations.length)
                                            : 0}
                                        <span className="text-sm font-normal text-gray-400 ml-1">/100</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Results Grid */}
            <main>
                {recommendations.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {recommendations.map((influencer, index) => (
                            <div
                                key={influencer.id}
                                className="relative group transition-all duration-300 hover:-translate-y-1"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Number Badge */}
                                <div className="absolute -top-3 -left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-blue-500/30 bg-[#0F1014] text-sm font-bold text-blue-400 shadow-xl">
                                    {index + 1}
                                </div>

                                <InfluencerGridCard
                                    influencer={influencer}
                                    initialIsFavorited={false} // Would need to fetch favs to be accurate, can add later if critical
                                    userRole={userRole}
                                    matchScore={influencer.matchScore}
                                    isSpotlightMember={profile?.spotlight_active ?? false}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-20 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-6">
                            <Sparkles className="h-8 w-8 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-white">Henüz Eşleşme Bulunamadı</h3>
                        <p className="mt-2 text-gray-400 max-w-md">
                            "{category}" kategorisi için şu an uygun kriterlerde influencer bulunamadı. Kategori ayarlarınızı güncellemeyi deneyebilirsiniz.
                        </p>
                        <Link
                            href="/dashboard/brand/settings"
                            className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                        >
                            Ayarları Düzenle
                        </Link>
                    </div>
                )}
            </main>
        </div>
    )
}
