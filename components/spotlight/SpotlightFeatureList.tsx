import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui'

export interface SpotlightFeature {
  icon: LucideIcon
  title: string
  description: string
}

export default function SpotlightFeatureList({ features }: { features: SpotlightFeature[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {features.map((feature) => (
        <Card key={feature.title} className="flex gap-3.5 p-5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <feature.icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14.5px] font-medium text-ink">{feature.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{feature.description}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
