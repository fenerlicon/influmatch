'use client'

import { BrainCircuit, ShieldCheck, Zap, MessageSquare, Target, Activity } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
    {
        icon: BrainCircuit,
        title: 'AI Destekli Eşleşme',
        description: 'Markanızın hedeflerine ve kimliğine en uygun influencerları yapay zeka algoritmalarımızla saniyeler içinde bulun.',
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
    },
    {
        icon: ShieldCheck,
        title: 'Güven Puanı & Şeffaflık',
        description: 'Influencerların gerçek etkileşim oranlarını, takipçi kalitesini ve güven puanlarını şeffaf bir şekilde görüntüleyin.',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
    },
    {
        icon: Zap,
        title: 'Spotlight Vitrini',
        description: 'En popüler ve yükselişteki influencerlar Spotlight vitrininde! Markalar için özenle seçilmiş yetenekleri keşfedin.',
        color: 'text-soft-gold',
        bg: 'bg-soft-gold/10',
        border: 'border-soft-gold/20',
    },
    {
        icon: MessageSquare,
        title: 'Anlık İletişim',
        description: 'Modern mesajlaşma altyapısı ile influencerlarla doğrudan iletişime geçin, tekliflerinizi hızlıca yönetin.',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
    },
    {
        icon: Target,
        title: 'Hedef Odaklı Kampanyalar',
        description: 'Kampanya bütçenizi ve hedeflerinizi belirleyin, sadece kriterlerinize uyan influencerlardan teklif alın.',
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
    },
    {
        icon: Activity,
        title: 'Gerçek Zamanlı Analiz',
        description: 'Kampanya performansını ve influencer etkileşimlerini anlıkverilerle takip edin, raporlayın.',
        color: 'text-pink-400',
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/20',
    },
]

export default function FeaturesSection() {
    return (
        <section className="relative py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-soft-gold">
                        YENİ NESİL ÖZELLİKLER
                    </h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Influencer Marketing'in <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-soft-gold to-white">
                            En Güçlü Araçları
                        </span>
                    </p>
                    <p className="mt-6 text-lg leading-8 text-gray-300">
                        Influmatch, markalar ve influencerlar arasındaki iş birliğini optimize etmek için geliştirilmiş, veri odaklı ve akıllı özellikler sunar.
                    </p>
                </div>

                <div className="mx-auto mt-16 max-w-7xl sm:mt-20 lg:mt-24">
                    <dl className="grid grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
                        {features.map((feature, index) => (
                            <div
                                key={feature.title}
                                className={`relative flex flex-col rounded-3xl border ${feature.border} ${feature.bg} p-8 hover:bg-white/5 transition duration-300`}
                            >
                                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 ${feature.bg}`}>
                                        <feature.icon className={`h-6 w-6 ${feature.color}`} aria-hidden="true" />
                                    </div>
                                    {feature.title}
                                </dt>
                                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                                    <p className="flex-auto">{feature.description}</p>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </section>
    )
}
