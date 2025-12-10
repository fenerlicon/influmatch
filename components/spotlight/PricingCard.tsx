import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

interface PricingFeature {
    text: string
    highlight?: boolean
}

interface PricingCardProps {
    title: string
    price: string
    originalPrice?: string
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
    originalPrice,
    interval,
    features,
    recommended,
    buttonText = 'Paketi Seç',
    onSelect,
    variant = 'influencer'
}: PricingCardProps) {
    const isInfluencer = variant === 'influencer'
    const isBrand = variant === 'brand'

    const containerStyles = recommended
        ? isInfluencer ? 'border-soft-gold bg-gradient-to-b from-[#151621] to-soft-gold/10 shadow-[0_0_50px_-10px_rgba(212,175,55,0.5)]' :
            isBrand ? 'border-blue-500 bg-gradient-to-b from-[#151621] to-blue-500/10 shadow-[0_0_50px_-10px_rgba(255,215,0,0.3)]' :
                'border-purple-500 bg-gradient-to-b from-[#151621] to-purple-500/10 shadow-[0_0_50px_-10px_rgba(168,85,247,0.5)]'
        : 'border-white/10 bg-white/5 hover:border-soft-gold/30 hover:shadow-[0_0_30px_-10px_rgba(212,175,55,0.2)]'

    const accentColor = isInfluencer ? 'text-soft-gold border-soft-gold/20 bg-soft-gold/10' :
        isBrand ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
            'text-purple-400 border-purple-400/20 bg-purple-400/10'

    const buttonColor = isInfluencer ? 'bg-soft-gold text-black hover:bg-soft-gold/90 shadow-[0_0_20px_-5px_rgba(212,175,55,0.5)]' :
        isBrand ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]' :
            'bg-purple-500 text-white hover:bg-purple-600 shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]'

    return (
        <div className={cn(
            "relative flex h-full flex-col rounded-[24px] border p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
            containerStyles,
            recommended && "scale-[1.02]"
        )}>
            {recommended && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <div className={cn(
                        "rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg border border-white/10 backdrop-blur-md",
                        isInfluencer ? "bg-soft-gold text-black shadow-soft-gold/40" :
                            isBrand ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-blue-500/40" :
                                "bg-purple-500 text-white shadow-purple-500/40"
                    )}>
                        En Popüler
                    </div>
                </div>
            )}

            <div className="text-center">
                <h3 className="text-lg font-bold tracking-wide text-gray-200">{title}</h3>
                <div className="mt-4 flex flex-col items-center justify-center gap-1">
                    {originalPrice && (
                        <span className="text-lg font-bold text-red-500 line-through decoration-red-500 decoration-2 opacity-80">
                            {originalPrice}
                        </span>
                    )}
                    <div className="flex items-baseline justify-center gap-1">
                        <span className={cn("text-4xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400",
                            recommended ? "to-white" : "to-gray-500"
                        )}>
                            {price}
                        </span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">/{interval === 'mo' ? 'ay' : 'yıl'}</span>
                    </div>
                </div>
            </div>

            <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <ul className="flex-1 space-y-3">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs leading-relaxed">
                        <div className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", accentColor)}>
                            <Check className="h-2.5 w-2.5" />
                        </div>
                        <span className={cn("text-gray-400", feature.highlight && "font-semibold text-white")}>
                            {feature.text}
                        </span>
                    </li>
                ))}
            </ul>

            <button
                onClick={onSelect}
                className={cn(
                    "mt-6 w-full rounded-xl py-3 text-xs font-bold tracking-widest uppercase transition-all active:scale-95",
                    buttonColor
                )}
            >
                {buttonText}
            </button>
        </div>
    )
}
