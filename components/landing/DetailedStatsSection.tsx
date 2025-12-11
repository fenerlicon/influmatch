'use client'

import { Percent, TrendingUp, BarChart3, Database, CalendarClock, MessageCircle } from 'lucide-react'

const statsFeatures = [
    {
        icon: TrendingUp,
        title: 'Etkileşim Oranı Analizi',
        description: 'Beğeni, yorum ve izlenme oranlarını detaylı inceleyin.',
        stat: '%5.2',
        label: 'Ort. Etkileşim',
    },
    {
        icon: Percent,
        title: 'Güven Puanı (Trust Score)',
        description: 'Bot takipçi analizi ve hesap sağlığı kontrolü.',
        stat: '98/100',
        label: 'Güven Skoru',
    },
    {
        icon: CalendarClock,
        title: 'Paylaşım Sıklığı',
        description: 'Influencer\'ın içerik üretme düzenini ve istikrarını görün.',
        stat: '2.4 Gün',
        label: 'Ort. Sıklık',
    },
    {
        icon: MessageCircle,
        title: 'Detaylı Medya Analizi',
        description: 'Ortalama beğeni, yorum ve izlenme sayılarına ulaşın.',
        stat: 'Aktif',
        label: 'Veri Durumu',
    },
]

export default function DetailedStatsSection() {
    return (
        <section className="relative overflow-hidden py-24 sm:py-32 bg-[#0f0f16]/50">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-y-16 lg:grid-cols-2 lg:gap-x-16 items-center">
                    <div className="relative">
                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl opacity-50" />
                        <div className="relative">
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-400">
                                VERİ ODAKLI YAKLAŞIM
                            </h2>
                            <h3 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                Tahminlere Dayalı Değil,<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                    Verilere Dayalı Kararlar Verin
                                </span>
                            </h3>
                            <p className="mt-6 text-lg leading-8 text-gray-300">
                                Influencer seçiminde risk almayın. Influmatch'in gelişmiş veri analitiği araçları ile her hesabın röntgenini çekin. Gizli metrikleri, sahte etkileşimleri ve gerçek potansiyeli ortaya çıkarın.
                            </p>

                            <div className="mt-10 flex flex-wrap gap-4">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                                    <Database className="h-4 w-4" />
                                    <span>Gerçek Zamanlı Veri</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm">
                                    <BarChart3 className="h-4 w-4" />
                                    <span>Derinlemesine Analiz</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {statsFeatures.map((item, index) => (
                            <div
                                key={item.title}
                                className="relative group rounded-2xl border border-white/5 bg-white/5 p-6 hover:bg-white/10 transition-colors duration-300"
                            >
                                <div className="absolute top-4 right-4 text-xs font-mono text-gray-500 group-hover:text-white transition-colors">
                                    {item.label}: <span className="text-white font-bold">{item.stat}</span>
                                </div>
                                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <item.icon className="h-5 w-5 text-blue-400" />
                                </div>
                                <h4 className="text-base font-semibold text-white mb-2">
                                    {item.title}
                                </h4>
                                <p className="text-sm text-gray-400">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
