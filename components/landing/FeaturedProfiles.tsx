import Link from 'next/link'
import { Avatar, Card, Chip, VerifiedTick } from '@/components/ui'
import { getCategoryLabel } from '@/utils/categories'

export interface FeaturedProfile {
  id: string
  full_name: string | null
  username: string | null
  category: string | null
  city: string | null
  avatar_url: string | null
  has_verified_badge: boolean
  platforms: { platform: string; follower_count: number | null }[]
}

const compact = (n: number | null) =>
  n === null ? null : n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M` : n >= 1000 ? `${(n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B` : String(n)

/** Spotlight'taki doğrulanmış influencer'lar (gerçek veri; yoksa bölüm gösterilmez). */
export default function FeaturedProfiles({ profiles }: { profiles: FeaturedProfile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {profiles.slice(0, 8).map((p) => {
        const name = p.full_name || `@${p.username}`
        return (
          <Link key={p.id} href={`/profile/${p.username}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
            <Card padded className="h-full transition-colors hover:border-line-strong">
              <div className="flex items-center gap-3">
                <Avatar name={name} src={p.avatar_url ?? undefined} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate font-medium text-ink">
                    <span className="truncate">{name}</span>
                    {p.has_verified_badge && <VerifiedTick />}
                  </div>
                  <div className="truncate text-xs text-ink-faint">
                    {[p.category ? getCategoryLabel(p.category) : null, p.city].filter(Boolean).join(' · ') || `@${p.username}`}
                  </div>
                </div>
              </div>
              {p.platforms.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.platforms.map((pl) => (
                    <Chip key={pl.platform}>
                      {pl.platform === 'tiktok' ? 'TikTok' : 'Instagram'}
                      {compact(pl.follower_count) ? ` · ${compact(pl.follower_count)}` : ''}
                    </Chip>
                  ))}
                </div>
              )}
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
