import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

interface PricingFeature {
    text: string
    highlight?: boolean
}

interface PricingCardProps {
    title: string
    price: string
    interval: 'mo' | 'yr'
    features: PricingFeature[]
    recommended?: boolean
    buttonText?: string
    onSelect?: () => void
    variant?: 'influencer' | 'brand' | 'agency'
}

export default function PricingCard({
    title,
    price,
    interval,
    features,
    recommended,
    buttonText = 'Paketi Seç',
    onSelect,
    variant = 'influencer'
}: PricingCardProps) {
    const isInfluencer = variant === 'influencer'
    const isBrand = variant === 'brand'

    const accentColor = isInfluencer ? 'text-soft-gold border-soft-gold/20 bg-soft-gold/5' :
        isBrand ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
            'text-purple-400 border-purple-400/20 bg-purple-400/5'

    const buttonColor = isInfluencer ? 'bg-soft-gold text-black hover:bg-soft-gold/90' :
        isBrand ? 'bg-blue-500 text-white hover:bg-blue-600' :
            'bg-purple-500 text-white hover:bg-purple-600'

    return (
        <div className={cn(
            "relative rounded-3xl border p-6 transition-all duration-300 hover:shadow-lg",
            recommended ? `border-${isInfluencer ? 'soft-gold' : isBrand ? 'blue-500' : 'purple-500'} bg-[#151621]` : "border-white/10 bg-white/5",
            recommended && "scale-105 shadow-glow"
        )}>
            {recommended && (
                <div className={cn(
                    "absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider text-black",
                    isInfluencer ? "bg-soft-gold" : isBrand ? "bg-blue-500" : "bg-purple-500"
                )}>
                    En Popüler
                </div>
            )}

            <div className="text-center">
                <h3 className="text-lg font-medium text-gray-300">{title}</h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">{price}</span>
                    <span className="text-sm text-gray-500">/{interval === 'mo' ? 'ay' : 'yıl'}</span>
                </div>
            </div>

            <ul className="mt-8 space-y-4">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                        <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", accentColor)}>
                            <Check className="h-3 w-3" />
                        </div>
                        <span className={cn("text-gray-300", feature.highlight && "font-medium text-white")}>
                            {feature.text}
                        </span>
                    </li>
                ))}
            </ul>

            <button
                onClick={onSelect}
                className={cn(
                    "mt-8 w-full rounded-xl py-3 text-sm font-bold transition-transform active:scale-95",
                    buttonColor
                )}
            >
                {buttonText}
            </button>
        </div>
    )
}
