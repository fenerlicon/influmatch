import { Building2, Clock, Users } from 'lucide-react'
import Link from 'next/link'

export default function AgencySpotlightPage() {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-8 text-center">
            <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-purple-500/20 blur-xl" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-purple-500/30 bg-[#151621] shadow-2xl">
                    <Building2 className="h-10 w-10 text-purple-400" />
                </div>
            </div>

            <div className="max-w-2xl px-4">
                <div className="mb-4 inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5">
                    <Clock className="mr-2 h-3 w-3 text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Çok Yakında</span>
                </div>

                <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                    Spotlight <span className="text-purple-400">Agency</span>
                </h1>

                <p className="mt-6 text-lg text-gray-400">
                    Ajanslar için gelişmiş influencer portföy yönetimi, çoklu marka kontrolü ve otomatik casting altyapısı hazırlanıyor.
                </p>
            </div>

            <div className="grid gap-4 text-left sm:grid-cols-2 lg:gap-8">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-purple-400">
                        <Users className="h-4 w-4" />
                        <h3 className="font-semibold text-white">Çoklu Marka Yönetimi</h3>
                    </div>
                    <p className="text-sm text-gray-400">Tüm müşterilerinizi tek panelden yönetin.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-purple-400">
                        <Users className="h-4 w-4" />
                        <h3 className="font-semibold text-white">Ajans-Verified Rozeti</h3>
                    </div>
                    <p className="text-sm text-gray-400">Ajansınıza bağlı influencerlar için resmi doğrulama.</p>
                </div>
            </div>

            <div className="mt-8">
                <Link
                    href="/dashboard/spotlight"
                    className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                    Geri Dön
                </Link>
            </div>
        </div>
    )
}
