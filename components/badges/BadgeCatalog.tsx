'use client'

import { useState } from 'react'
import { influencerBadges, brandBadges, phaseConfig, type BadgePhase } from '@/app/badges/data'
import { Card, CardBody, CardHeader, Chip, Segmented } from '@/components/ui'

/** Tüm rozetler (influencer / marka), sürüme göre gruplu. Panelde ve herkese açık /badges sayfasında. */
export default function BadgeCatalog({ defaultRole = 'influencer' }: { defaultRole?: 'influencer' | 'brand' }) {
  const [catalog, setCatalog] = useState<'influencer' | 'brand'>(defaultRole)
  const badges = catalog === 'influencer' ? influencerBadges : brandBadges

  return (
    <Card>
      <CardHeader
        title="Rozet kataloğu"
        action={
          <Segmented
            label="Katalog"
            value={catalog}
            onSelect={(v) => setCatalog(v as 'influencer' | 'brand')}
            items={[
              { value: 'influencer', label: 'Influencer' },
              { value: 'brand', label: 'Marka' },
            ]}
          />
        }
      />
      <CardBody className="grid gap-6">
        {(['mvp', 'v1.2', 'v1.3'] as BadgePhase[]).map((phase) => {
          const phaseBadges = badges.filter((b) => b.phase === phase)
          if (phaseBadges.length === 0) return null
          return (
            <section key={`${catalog}-${phase}`} className="grid gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold">{phase === 'mvp' ? 'Şu an kazanılabilenler' : 'Sonraki sürümler'}</h3>
                <Chip>{phaseConfig[phase].label}</Chip>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {phaseBadges.map((badge) => {
                  const Icon = badge.icon
                  return (
                    <div key={badge.id} className={`flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5 ${phase === 'mvp' ? '' : 'opacity-70'}`}>
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gold/10 text-gold">
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-ink">{badge.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{badge.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </CardBody>
    </Card>
  )
}
