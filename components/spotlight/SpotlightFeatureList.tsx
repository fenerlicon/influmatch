import { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface Feature {
    icon: LucideIcon
    title: string
    description: string
}

interface SpotlightFeatureListProps {
    features: Feature[]
    variant?: 'influencer' | 'brand' | 'agency'
}

export default function SpotlightFeatureList({ features, variant = 'influencer' }: SpotlightFeatureListProps) {
    const isInfluencer = variant === 'influencer'
    const isBrand = variant === 'brand'

    const iconContainerClass = isInfluencer
        ? "border-soft-gold/40 bg-soft-gold/10 text-soft-gold"
        : isBrand
            ? "border-blue-400/40 bg-blue-400/10 text-blue-400"
            : "border-purple-400/40 bg-purple-400/10 text-purple-400"

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
                <div
                    key={i}
                    className="group flex flex-col gap-4 rounded-3xl border border-white/5 bg-white/5 p-6 transition-colors hover:border-white/10 hover:bg-white/[0.07]"
                >
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110", iconContainerClass)}>
                        <feature.icon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{feature.title}</h3>
                        <p className="mt-2 text-sm text-gray-400 leading-relaxed">{feature.description}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
