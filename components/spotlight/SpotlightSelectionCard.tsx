import Link from 'next/link'
import { LucideIcon, ArrowRight } from 'lucide-react'
import { cn } from '@/utils/cn'

interface SpotlightSelectionCardProps {
    title: string
    description: string
    icon: LucideIcon
    href: string
    variant: 'influencer' | 'brand' | 'agency'
    isComingSoon?: boolean
    disabled?: boolean
    disabledReason?: string
}

export default function SpotlightSelectionCard({
    title,
    description,
    icon: Icon,
    href,
    variant,
    isComingSoon,
    disabled,
    disabledReason
}: SpotlightSelectionCardProps) {
    const isInfluencer = variant === 'influencer'
    const isBrand = variant === 'brand'
    const isAgency = variant === 'agency'

    const borderColor = isInfluencer ? 'group-hover:border-soft-gold/50' :
        isBrand ? 'group-hover:border-blue-400/50' :
            'group-hover:border-purple-400/50'

    const iconColor = isInfluencer ? 'text-soft-gold' :
        isBrand ? 'text-blue-400' :
            'text-purple-400'

    const bgGradient = isInfluencer ? 'from-soft-gold/10' :
        isBrand ? 'from-blue-400/10' :
            'from-purple-400/10'

    const CardContent = (
        <>
            <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100", bgGradient)} />

            <div className="relative z-10 flex h-full flex-col">
                <div className={cn("mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-110", iconColor)}>
                    <Icon className="h-8 w-8" />
                </div>

                <h3 className="mb-3 text-2xl font-bold text-white">{title}</h3>
                <p className="mb-8 text-gray-400 leading-relaxed">{description}</p>

                {isComingSoon ? (
                    <div className="mt-auto flex items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                        Yakında
                    </div>
                ) : disabled ? (
                    <div className="mt-auto flex items-center justify-center rounded-xl border border-white/5 bg-white/5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                        {disabledReason || "Erişilemez"}
                    </div>
                ) : (
                    <div className={cn("mt-auto flex items-center gap-2 font-semibold transition-gap duration-300 group-hover:gap-3", iconColor)}>
                        İncele <ArrowRight className="h-4 w-4" />
                    </div>
                )}
            </div>
        </>
    )

    if (disabled || isComingSoon) {
        return (
            <div className={cn(
                "group relative flex flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-8",
                disabled && "opacity-60 grayscale cursor-not-allowed",
                isComingSoon && "cursor-default opacity-80"
            )}>
                {CardContent}
            </div>
        )
    }

    return (
        <Link
            href={href}
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0F1014] p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                borderColor
            )}
        >
            {CardContent}
        </Link>
    )
}
