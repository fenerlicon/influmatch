import { notFound } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, AtSign, BadgeCheck, Briefcase, Building2, ExternalLink, Instagram, MapPin, Music2, ShieldCheck,
} from 'lucide-react'
import { Avatar, ButtonLink, buttonClasses, Card, CardBody, CardHeader, Chip, EmptyState, SpotlightMark, Tabs, VerifiedTick } from '@/components/ui'
import OfferModal from '@/components/profile/OfferModal'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { resolveSubscriptionTier, type SubscriptionTier } from '@/lib/subscription-tier'
import BadgeDetailList from '@/components/badges/BadgeDetailList'
import { getCategoryLabel } from '@/utils/categories'
import InfluencerStats from '@/components/profile/InfluencerStats'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import { completedCollaborationCounts } from '@/lib/collaborations'
import { brandReliability } from '@/lib/collaboration-workspace'
import { reliabilityText } from '@/lib/collaboration-workspace-shared'
import { getVisibleRateCard } from '@/lib/rate-card'
import RateCardView from '@/components/profile/RateCardView'
import DiscoveryWheelCard from '@/components/dashboard/DiscoveryWheelCard'
import { availabilityOf, getProfileForViewer } from '@/lib/profile-reads'
import { availabilityText, busyOfferWarning } from '@/lib/availability-shared'
import { listOpenCampaignOptionsAs } from '@/lib/campaigns'
import { getOfferQuota, offerQuotaSummary } from '@/lib/brand-limits'
import { getPortfolioForProfile } from '@/lib/portfolio-results'
import PortfolioResults from '@/components/profile/PortfolioResults'

interface ProfilePageProps {
  params: { username: string }
  searchParams?: { teklif?: string; kampanya?: string; tab?: string }
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  website: 'Web sitesi',
}

const compact = (n: number | null | undefined) =>
  !n ? '—' : n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M` : n >= 1000 ? `${(n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B` : String(n)

function LockedFrame({ backHref, children }: { backHref: string; children: React.ReactNode }) {
  return (
    <div className="max-w-[1180px]">
      <ButtonLink href={backHref} variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2 mb-3">
        Geri
      </ButtonLink>
      {children}
    </div>
  )
}

export default async function ProfileDetailPage({ params, searchParams }: ProfilePageProps) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()
  // Profiller yalnızca oturum açmış kullanıcılara görünür (middleware de korur).
  if (!viewer) notFound()

  // Başkasının profili yalnızca sunucuda, kurallar uygulanarak okunur (lib/profile-reads.ts, 3.17-S2):
  // onaysız marka profil görmez; ücretsiz marka (sınırlar açıkken) yalnızca çarktaki ya da daha önce teklif /
  // iş birliği / sohbet / başvuru ilişkisi olan profilleri açar. Bayrak kapalıyken herkes açılır.
  const access = await getProfileForViewer(supabase, viewer.id, { username: params.username })
  if (access.status === 'not_found') notFound()

  if (access.status === 'brand_unverified') {
    return (
      <LockedFrame backHref="/dashboard/brand/discover">
        <BrandLockScreen status={access.viewer.verification_status === 'rejected' ? 'rejected' : 'pending'} />
      </LockedFrame>
    )
  }

  if (access.status === 'wheel_blocked') {
    return (
      <LockedFrame backHref="/dashboard/brand/discover">
        <DiscoveryWheelCard
          variant="profile"
          profilesPerSpin={access.wheel.profilesPerSpin}
          windowHours={access.wheel.windowHours}
          expiresAt={access.wheel.spin?.expires_at ?? null}
        />
      </LockedFrame>
    )
  }

  const { profile, socialAccounts, viewer: viewerInfo } = access
  const instagramAccount = socialAccounts.find((a) => a.platform === 'instagram')
  const tiktokAccount = socialAccounts.find((a) => a.platform === 'tiktok')

  const instagramData = instagramAccount && instagramAccount.has_stats ? {
    username: instagramAccount.username ?? '',
    followerCount: instagramAccount.follower_count || 0,
    engagementRate: Number(instagramAccount.engagement_rate) || 0,
    statsPayload: instagramAccount.stats_payload as any,
    lastUpdated: instagramAccount.updated_at || new Date().toISOString()
  } : undefined

  const tiktokData = tiktokAccount && (tiktokAccount.has_stats || tiktokAccount.is_verified) ? {
    username: tiktokAccount.username ?? '',
    followerCount: tiktokAccount.follower_count || 0,
    engagementRate: Number(tiktokAccount.engagement_rate) || 0,
    statsPayload: tiktokAccount.stats_payload as any,
    lastUpdated: tiktokAccount.updated_at || new Date().toISOString()
  } : undefined

  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', profile.id)

  const viewerRole = viewerInfo.role
  const isInfluencer = profile.role === 'influencer'
  const isBrand = profile.role === 'brand'
  const canSendOffer = viewerRole === 'brand' && isInfluencer && viewer.id !== profile.id

  // Profil görüntülenmesi (kişi başına günde bir; kendi profili sayılmaz). Sayılar yalnızca Spotlight
  // üyesi profil sahibine gösterilir. Kayıt başarısız olsa da sayfa açılır.
  if (isInfluencer && viewer.id !== profile.id) {
    const { error: viewError } = await supabase.rpc('record_profile_view', { p_profile_id: profile.id })
    if (viewError) console.error('[profile] görüntülenme kaydedilemedi:', viewError.message)
  }
  // Geri dönüş izleyicinin kendi keşif ekranına (influencer marka keşfine düşmemeli).
  const backHref =
    viewerRole === 'brand' ? '/dashboard/brand/discover' : viewerRole === 'influencer' ? '/dashboard/influencer/discover' : viewerRole === 'admin' ? '/admin' : '/dashboard'

  const rawSocialLinks = (profile.social_links as Record<string, string> | null) ?? {}
  const enrichedSocialLinks = { ...rawSocialLinks }

  if (instagramAccount && instagramAccount.username && (instagramAccount.is_verified || !enrichedSocialLinks.instagram)) {
    // Clean username in case it was stored with URL parameters
    let cleanInsta = instagramAccount.username.replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase().replace('@', '').trim();
    if (cleanInsta.includes('instagram.com/')) {
      const parts = cleanInsta.split('instagram.com/');
      if (parts.length > 1) {
        cleanInsta = parts[1].split('?')[0].split('/')[0].trim();
      }
    }
    enrichedSocialLinks.instagram = `https://instagram.com/${cleanInsta}`
  }
  if (tiktokAccount && tiktokAccount.username && (tiktokAccount.is_verified || !enrichedSocialLinks.tiktok)) {
    // Clean username in case it was stored with URL parameters
    let cleanTT = tiktokAccount.username.replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase().replace('@', '').trim();
    if (cleanTT.includes('tiktok.com/')) {
      const parts = cleanTT.split('tiktok.com/');
      if (parts.length > 1) {
        cleanTT = parts[1].split('?')[0].split('/')[0].replace('@', '').trim();
      }
    }
    enrichedSocialLinks.tiktok = `https://tiktok.com/@${cleanTT}`
  }

  const socialLinksEntries = Object.entries(enrichedSocialLinks).filter(
    ([, value]) => Boolean(value),
  )

  // İzleyicinin paketi ve onay durumu
  const isViewerVerified = viewerInfo.verification_status === 'verified'
  const viewerTier: SubscriptionTier = resolveSubscriptionTier(viewerInfo)

  // Teklif hakkı bilgisi (yalnızca sınır uygulanan markada; bayrak kapalıyken null).
  const offerQuotaText = canSendOffer ? offerQuotaSummary(await getOfferQuota(viewer.id).catch(() => null)) : null
  // Müsaitlik (3.19): "Şu an dolu" profilde görünür, teklif penceresi uyarır (teklif yine gönderilebilir).
  const availability = isInfluencer ? availabilityOf(profile) : null
  // Teklifi kampanyaya bağlama (3.19): markanın taslak / aktif kampanyaları.
  const campaignOptions = canSendOffer ? await listOpenCampaignOptionsAs(supabase, viewer.id) : []

  // Tamamlanan iş birliği sayısı (herkes görür) ve fiyat kartı (RLS: yalnızca sahibi, doğrulanmış marka, admin).
  const [completedCounts, rateCard] = isInfluencer
    ? await Promise.all([completedCollaborationCounts(supabase, [profile.id]), getVisibleRateCard(supabase, profile.id)])
    : [new Map<string, number>(), null]
  const completedCollaborations = completedCounts.get(profile.id) ?? 0
  // Marka güvenilirliği (3.18): tamamlanan iş birliği ve influencer'ın ödemeyi teyit ettiği sayı (sunucuda, yalnızca sayılar).
  const reliability = isBrand ? (await brandReliability(supabase, [profile.id])).get(profile.id) ?? { completed: 0, confirmed: 0 } : null
  const isOwnProfile = viewer?.id === profile.id
  // Portföyde iş birliği sonuçları (4.3-S7): başkalarına yalnızca profil sahibi Influencer Pro ise; sahibi her zaman görür
  // (gizle / göster + Pro değilse kilit notu). Kurallar sunucuda (lib/portfolio-results.ts).
  const portfolio = isInfluencer ? await getPortfolioForProfile(viewer.id, profile) : null

  // Get all badge IDs for this user (only pass IDs, not badge objects)
  const badgeIds = userBadges?.map((ub) => ub.badge_id).filter((id): id is string => typeof id === 'string') ?? []

  const name = profile.full_name ?? profile.username ?? 'Profil'
  const roleLabel = isInfluencer
    ? profile.creator_type === 'ugc' ? 'UGC' : profile.creator_type === 'both' ? 'UGC ve Influencer' : 'Influencer'
    : isBrand ? 'Marka' : 'Kullanıcı'
  const hasTick = badgeIds.includes('verified-account') || (isBrand && badgeIds.includes('official-business'))
  const platforms = [instagramAccount, tiktokAccount].filter((a): a is NonNullable<typeof a> => !!a && !!(a.is_verified || a.has_stats))
  const hasStats = !!(instagramData || tiktokData)

  // Sekmeler (?tab=): yalnızca içeriği olanlar
  const tabs = [
    { value: 'genel', label: 'Genel bakış' },
    ...(isInfluencer ? [{ value: 'istatistik', label: 'İstatistikler' }] : []),
    ...(badgeIds.length ? [{ value: 'rozetler', label: 'Rozetler', count: badgeIds.length }] : []),
    ...(portfolio ? [{ value: 'is-gecmisi', label: 'İş geçmişi', count: portfolio.items.length || undefined }] : []),
  ]
  const requested = typeof searchParams?.tab === 'string' ? searchParams.tab : 'genel'
  const activeTab = tabs.some((t) => t.value === requested) ? requested : 'genel'
  const tabHref = (value: string) => (value === 'genel' ? `/profile/${profile.username}` : `/profile/${profile.username}?tab=${value}`)

  return (
    <div className="max-w-[1180px]">
      <ButtonLink href={backHref} variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2 mb-3">
        Geri
      </ButtonLink>

      {/* Başlık kartı */}
      <Card as="section" padded className={`grid gap-5 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:p-7${profile.spotlight_active ? ' spotlight-card' : ''}`}>
        <Avatar name={name} src={profile.avatar_url ?? undefined} size="xl" square={isBrand} />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Chip>{roleLabel}</Chip>
            {profile.category && <Chip>{getCategoryLabel(profile.category)}</Chip>}
          </div>
          <h1 className="flex items-center gap-2 font-display text-[32px] font-normal leading-[1.1] md:text-[38px]">
            <span className="truncate">{name}</span>
            {hasTick && (
              <VerifiedTick
                tone={isBrand ? 'gold' : 'blue'}
                className="h-5 w-5"
                label={isBrand ? 'Onaylanmış işletme' : 'Mavi tik: doğrulanmış içerik üreticisi'}
              />
            )}
            {profile.spotlight_active && <SpotlightMark className="[&_svg]:h-5 [&_svg]:w-5" />}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><AtSign className="h-3.5 w-3.5" aria-hidden />{profile.username}</span>
            {profile.city && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden />{profile.city}</span>}
            {isInfluencer && (
              <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" aria-hidden />{completedCollaborations} tamamlanan iş</span>
            )}
            {reliability && (
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{reliabilityText(reliability.completed, reliability.confirmed)}</span>
            )}
          </div>
          {availability && (
            <div className="mt-3">
              <Chip tone={availability.status === 'busy' ? 'warning' : 'success'} dot>
                {availabilityText(availability)}
                {availability.status === 'busy' && availability.note ? ` · ${availability.note}` : ''}
              </Chip>
            </div>
          )}
          {profile.bio && <p className="mt-3.5 max-w-[640px] whitespace-pre-line text-[14px] text-ink-muted">{profile.bio}</p>}
        </div>
        {canSendOffer && (
          <div className="grid gap-2 md:w-[220px]">
            <OfferModal
              receiverId={profile.id}
              receiverName={profile.full_name || profile.username || ''}
              isViewerVerified={isViewerVerified}
              quotaText={offerQuotaText}
              defaultOpen={searchParams?.teklif === '1'}
              busyWarning={availability ? busyOfferWarning(availability, profile.full_name || profile.username) : null}
              campaigns={campaignOptions}
              defaultCampaignId={typeof searchParams?.kampanya === 'string' ? searchParams.kampanya : null}
              block
            />
            {offerQuotaText && <p className="text-center text-xs text-ink-faint">{offerQuotaText}</p>}
          </div>
        )}
      </Card>

      <Tabs className="mb-5 mt-5" label="Profil bölümleri" value={activeTab} items={tabs.map((t) => ({ ...t, href: tabHref(t.value) }))} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-5">
          {activeTab === 'genel' && (
            <>
              {platforms.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {platforms.map((account) => (
                    <Card key={account.platform} padded>
                      <div className="flex items-center gap-2 text-[14px] font-medium">
                        {account.platform === 'instagram' ? <Instagram className="h-4 w-4" aria-hidden /> : <Music2 className="h-4 w-4" aria-hidden />}
                        {account.platform === 'instagram' ? 'Instagram' : 'TikTok'}
                        {account.is_verified && <Chip tone="success" className="ml-auto"><ShieldCheck aria-hidden />Doğrulandı</Chip>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-ink-faint">Takipçi</div>
                          <div className="text-[20px] font-semibold tabular-nums">{compact(account.follower_count)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-ink-faint">Etkileşim</div>
                          <div className="text-[20px] font-semibold tabular-nums">
                            {account.engagement_rate ? `%${Number(account.engagement_rate).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '—'}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : isInfluencer ? (
                <Card>
                  <EmptyState icon={BadgeCheck} title="Veri doğrulanmadı" description="Bu kullanıcı henüz Instagram veya TikTok hesabını doğrulamadığı için istatistikler görüntülenemiyor." />
                </Card>
              ) : null}

              {badgeIds.length > 0 && (
                <Card>
                  <CardHeader
                    title="Öne çıkan rozetler"
                    action={badgeIds.length > 3 ? <ButtonLink href={tabHref('rozetler')} variant="ghost" size="sm" rightIcon={<ArrowRight />}>Tümü</ButtonLink> : undefined}
                  />
                  <CardBody>
                    <BadgeDetailList badgeIds={badgeIds} userRole={isInfluencer ? 'influencer' : 'brand'} limit={3} />
                  </CardBody>
                </Card>
              )}

              {isBrand && !badgeIds.length && !profile.bio && (
                <Card>
                  <EmptyState icon={Building2} title="Henüz bilgi yok" description="Marka profilini tamamladıkça burada görünecek." />
                </Card>
              )}
            </>
          )}

          {activeTab === 'istatistik' &&
            (hasStats ? (
              <InfluencerStats
                instagramData={instagramData}
                tiktokData={tiktokData}
                mode="brand-view"
                hideAnalysisText={false}
                subscriptionTier={viewerTier}
                viewerRole={viewerRole ?? undefined}
              />
            ) : (
              <Card>
                <EmptyState icon={BadgeCheck} title="Veri doğrulanmadı" description="Hesap doğrulanınca istatistikler burada görünür." />
              </Card>
            ))}

          {activeTab === 'rozetler' && (
            <Card padded className="grid gap-4">
              <BadgeDetailList badgeIds={badgeIds} userRole={isInfluencer ? 'influencer' : 'brand'} />
              {isOwnProfile && (
                <div>
                  <ButtonLink href={isBrand ? '/dashboard/brand/badges' : '/dashboard/influencer/badges'} size="sm" rightIcon={<ArrowRight />}>
                    Rozet ilerlemen ve tüm rozetler
                  </ButtonLink>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'is-gecmisi' && portfolio && (
            <Card padded>
              <PortfolioResults view={portfolio} />
            </Card>
          )}
        </div>

        <aside className="grid gap-5">
          {isInfluencer && rateCard && <RateCardView rateCard={rateCard} isOwner={isOwnProfile} />}

          {(isInfluencer || reliability) && (
            <Card padded>
              <h2 className="text-[17px] font-semibold tracking-tight">Güvenilirlik</h2>
              <dl className="mt-2 text-[13.5px]">
                <div className="flex justify-between border-b border-line py-2.5">
                  <dt className="text-ink-muted">Tamamlanan iş</dt>
                  <dd className="font-semibold tabular-nums">{isInfluencer ? completedCollaborations : reliability?.completed ?? 0}</dd>
                </div>
                {reliability && (
                  <div className="flex justify-between py-2.5">
                    <dt className="text-ink-muted">Ödemesi teyitli iş</dt>
                    <dd className="font-semibold tabular-nums">{reliability.confirmed}</dd>
                  </div>
                )}
                {isInfluencer && (
                  <div className="flex justify-between py-2.5">
                    <dt className="text-ink-muted">Doğrulanmış hesap</dt>
                    <dd className="font-semibold">{platforms.filter((p) => p.is_verified).map((p) => (p.platform === 'instagram' ? 'Instagram' : 'TikTok')).join(', ') || '—'}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {socialLinksEntries.length > 0 && (
            <Card padded>
              <h2 className="text-[17px] font-semibold tracking-tight">Hesaplar</h2>
              <ul className="mt-3 grid gap-2">
                {socialLinksEntries.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noreferrer" className={buttonClasses({ block: true, className: 'justify-between' })}>
                      {SOCIAL_LABELS[key] ?? key}
                      <ExternalLink aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
