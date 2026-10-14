'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Heart, Instagram, ListPlus, Lock, Music2, Sparkles } from 'lucide-react'
import { toggleFavorite } from '@/app/actions/favorites'
import { FAVORITES_LOCKED_ERROR } from '@/lib/favorites-shared'
import { getCategoryLabel } from '@/utils/categories'
import { calculateTrustScore } from '@/utils/matching'
import type { DiscoverInfluencer } from '@/types/influencer'
import { availabilityText } from '@/lib/availability-shared'
import { Avatar, Button, ButtonLink, Card, Chip, VerifiedTick } from '@/components/ui'
import { cn } from '@/utils/cn'
import AddToListModal from './AddToListModal'
import SimilarProfilesModal from './SimilarProfilesModal'

interface Props {
  influencer: DiscoverInfluencer
  viewerRole: 'brand' | 'influencer'
  isFavorited?: boolean
  /** Ücretsiz markada (sınırlar açıkken) favori / liste kilitli: Spotlight sayfasına götürür. */
  favoritesLocked?: boolean
  /** Benzer profiller Spotlight özelliği. */
  isSpotlightMember?: boolean
  matchScore?: number
  matchReasons?: string[]
  /** Fiyat kartındaki en düşük başlangıç fiyatı (yalnızca doğrulanmış markaya gelir). */
  startingPrice?: number | null
  completedCollaborations?: number
}

const CREATOR_LABEL = { influencer: 'Influencer', ugc: 'UGC', both: 'UGC & Influencer' } as const

/** Takipçi / etkileşim: en çok takipçili doğrulanmış platform, yoksa birleşik istatistik. */
function headline(influencer: DiscoverInfluencer) {
  const best = [...(influencer.platforms_data ?? [])].filter((p) => (p.follower_count ?? 0) > 0).sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))[0]
  if (best) return { followers: best.followers, engagement: best.engagement }
  const s = influencer.stats
  if (s && s.followers && s.followers !== '0' && s.followers !== '0%') return { followers: s.followers, engagement: s.engagement }
  return null
}

/** Keşif kartı (marka ve influencer keşfi, öneriler, favoriler, listeler). */
export default function ProfileCard({
  influencer,
  viewerRole,
  isFavorited: initialFavorited = false,
  favoritesLocked = false,
  isSpotlightMember = false,
  matchScore,
  matchReasons,
  startingPrice = null,
  completedCollaborations = 0,
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<'list' | 'similar' | null>(null)
  const isBrand = viewerRole === 'brand'
  const name = influencer.full_name || influencer.username || 'Profil'
  const profileHref = `/profile/${influencer.username || influencer.id}`
  const stats = headline(influencer)
  // Güven skoru (0-100) yalnızca markaya ve istatistiği olan profilde.
  const trust = isBrand && stats ? calculateTrustScore(influencer) : null
  const platforms = new Set([...(influencer.platforms ?? []), ...(influencer.platform ? [influencer.platform] : []), ...(influencer.platforms_data ?? []).map((p) => p.platform)])
  const spotlightHref = isBrand ? '/dashboard/spotlight/brand' : '/dashboard/spotlight/influencer'

  const toggleFav = async () => {
    if (busy) return
    const previous = favorited
    setFavorited(!previous)
    setBusy(true)
    try {
      const result = await toggleFavorite(influencer.id)
      if (result.error) {
        setFavorited(previous)
        toast.error(result.error === FAVORITES_LOCKED_ERROR ? result.error : 'Favori güncellenemedi.')
      } else if (result.isFavorited !== undefined) {
        setFavorited(result.isFavorited)
      }
    } catch {
      setFavorited(previous)
      toast.error('Favori güncellenemedi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="article" className={cn('flex flex-col gap-3.5 p-4 transition-colors hover:border-line-strong', matchScore !== undefined && matchScore >= 70 && 'border-gold/30')}>
      <div className="flex items-start gap-3">
        <Link href={profileHref} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={name} src={influencer.avatar_url} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="truncate">{name}</span>
              {influencer.displayed_badges?.includes('verified-account') && <VerifiedTick />}
            </div>
            {influencer.username && <div className="truncate text-xs text-ink-faint">@{influencer.username}</div>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {influencer.category && <Chip>{getCategoryLabel(influencer.category)}</Chip>}
              {influencer.creator_type && influencer.creator_type !== 'influencer' && <Chip>{CREATOR_LABEL[influencer.creator_type]}</Chip>}
              {influencer.spotlight_active && <Chip tone="gold">Spotlight</Chip>}
              {influencer.availability?.status === 'busy' && (
                <Chip tone="warning" dot title={availabilityText(influencer.availability)}>
                  Şu an dolu
                </Chip>
              )}
            </div>
          </div>
        </Link>
        <div className="-mr-1.5 -mt-1 flex flex-none">
          {isBrand &&
            (favoritesLocked ? (
              <ButtonLink size="sm" variant="ghost" iconOnly href="/dashboard/spotlight/brand" aria-label="Favoriler Spotlight markalara özel" title="Favoriler ve listeler Spotlight markalara özel">
                <Lock />
              </ButtonLink>
            ) : (
              <>
                <Button size="sm" variant="ghost" iconOnly aria-label="Listeye ekle" title="Listeye ekle" onClick={() => setModal('list')}>
                  <ListPlus />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  aria-pressed={favorited}
                  aria-label={favorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                  title={favorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                  onClick={toggleFav}
                  className={cn(favorited && 'text-gold hover:text-gold')}
                >
                  <Heart className={cn(favorited && 'fill-current')} />
                </Button>
              </>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-3 rounded-xl border border-line text-[13px]">
        {[
          ['Takipçi', stats?.followers ?? '—'],
          ['Etkileşim', stats?.engagement ?? '—'],
          ['Tamamlanan', completedCollaborations > 0 ? `${completedCollaborations} iş` : '—'],
        ].map(([k, v], i) => (
          <div key={k} className={cn('px-2.5 py-2', i > 0 && 'border-l border-line')}>
            <div className="text-[11px] text-ink-faint">{k}</div>
            <div className="mt-px truncate font-semibold tabular-nums text-ink">{v}</div>
          </div>
        ))}
      </div>

      <div className="-mt-1 flex items-center gap-2 text-xs text-ink-faint">
        {platforms.has('instagram') && <Instagram className="h-[13px] w-[13px]" aria-label="Instagram" />}
        {platforms.has('tiktok') && <Music2 className="h-[13px] w-[13px]" aria-label="TikTok" />}
        {trust !== null && (
          <span title="Etkileşim, takipçi ve doğrulama sinyallerinden hesaplanan güven skoru">
            Güven <b className={cn('font-semibold', trust > 70 ? 'text-success' : trust > 40 ? 'text-warning' : 'text-danger')}>{trust}</b>/100
          </span>
        )}
        <button
          type="button"
          onClick={() => (isSpotlightMember ? setModal('similar') : (window.location.href = spotlightHref))}
          title={isSpotlightMember ? undefined : 'Benzer profiller Spotlight üyelerine açık'}
          className="ml-auto inline-flex items-center gap-1 hover:text-ink"
        >
          {isSpotlightMember ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          Benzer profiller
        </button>
      </div>

      {matchScore !== undefined && matchScore > 0 && (
        <div className="border-t border-dashed border-line-strong pt-2.5 text-xs text-ink-faint">
          <span className="mr-1.5 text-ink-muted">
            Uyum <b className="font-semibold text-gold">%{matchScore}</b>
          </span>
          {matchReasons && matchReasons.length > 0 && matchReasons.join(' · ')}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="min-w-0">
          {isBrand && (
            <>
              <div className="text-xs text-ink-faint">Başlangıç</div>
              {typeof startingPrice === 'number' ? (
                <div className="font-semibold tabular-nums text-ink">₺{startingPrice.toLocaleString('tr-TR')}&apos;den</div>
              ) : (
                <div className="text-[13px] text-ink-faint">Fiyat kartı yok</div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <ButtonLink size="sm" href={profileHref}>
            Profil
          </ButtonLink>
          {isBrand && (
            <ButtonLink size="sm" variant="primary" href={`${profileHref}?teklif=1`}>
              Teklif
            </ButtonLink>
          )}
        </div>
      </div>

      {modal === 'list' && <AddToListModal open onClose={() => setModal(null)} influencerId={influencer.id} influencerName={name} />}
      {modal === 'similar' && <SimilarProfilesModal open onClose={() => setModal(null)} baseInfluencerId={influencer.id} baseInfluencerName={name} />}
    </Card>
  )
}
