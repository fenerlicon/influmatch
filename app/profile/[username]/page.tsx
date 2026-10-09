import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, BadgeCheck } from 'lucide-react'
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
import { getProfileForViewer } from '@/lib/profile-reads'
import { getOfferQuota, offerQuotaSummary } from '@/lib/brand-limits'

interface ProfilePageProps {
  params: { username: string }
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  website: 'Website',
}

export default async function ProfileDetailPage({ params }: ProfilePageProps) {
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
      <main className="min-h-screen bg-background px-4 py-10 text-white sm:px-8 lg:px-20">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="relative">
            <Link
              href="/dashboard/brand/discover"
              className="group inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur transition hover:border-soft-gold hover:text-soft-gold z-10"
            >
              <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
            </Link>
          </div>
          <BrandLockScreen status={access.viewer.verification_status === 'rejected' ? 'rejected' : 'pending'} />
        </div>
      </main>
    )
  }

  if (access.status === 'wheel_blocked') {
    return (
      <main className="min-h-screen bg-background px-4 py-10 text-white sm:px-8 lg:px-20">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="relative">
            <Link
              href="/dashboard/brand/discover"
              className="group inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur transition hover:border-soft-gold hover:text-soft-gold z-10"
            >
              <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
            </Link>
          </div>
          <DiscoveryWheelCard
            variant="profile"
            profilesPerSpin={access.wheel.profilesPerSpin}
            windowHours={access.wheel.windowHours}
            expiresAt={access.wheel.spin?.expires_at ?? null}
          />
        </div>
      </main>
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

  // Tamamlanan iş birliği sayısı (herkes görür) ve fiyat kartı (RLS: yalnızca sahibi, doğrulanmış marka, admin).
  const [completedCounts, rateCard] = isInfluencer
    ? await Promise.all([completedCollaborationCounts(supabase, [profile.id]), getVisibleRateCard(supabase, profile.id)])
    : [new Map<string, number>(), null]
  const completedCollaborations = completedCounts.get(profile.id) ?? 0
  // Marka güvenilirliği (3.18): tamamlanan iş birliği ve influencer'ın ödemeyi teyit ettiği sayı (sunucuda, yalnızca sayılar).
  const reliability = isBrand ? (await brandReliability(supabase, [profile.id])).get(profile.id) ?? { completed: 0, confirmed: 0 } : null
  const isOwnProfile = viewer?.id === profile.id

  // Get all badge IDs for this user (only pass IDs, not badge objects)
  const badgeIds = userBadges?.map((ub) => ub.badge_id).filter((id): id is string => typeof id === 'string') ?? []

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-white sm:px-8 lg:px-20">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Profile Card */}
        <section className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#15161F] to-[#0C0D10] p-6 sm:p-10 shadow-glow">
          <Link
            href={backHref}
            className="group absolute -left-3 -top-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur transition hover:border-soft-gold hover:text-soft-gold lg:-left-4 lg:-top-4 z-10"
          >
            <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
          </Link>

          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            {/* Avatar */}
            <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name ?? profile.username ?? 'Profil'}
                  fill
                  sizes="128px"
                  className="object-cover"
                  unoptimized
                  style={{ imageOrientation: 'from-image' }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-soft-gold">
                  {profile.full_name?.[0] ?? 'I'}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <p className="text-xs uppercase tracking-[0.4em] text-soft-gold font-bold">
                  {isInfluencer 
                    ? profile.creator_type === 'ugc' 
                      ? 'UGC' 
                      : profile.creator_type === 'both' 
                        ? 'UGC & Influencer' 
                        : 'Influencer' 
                    : isBrand 
                      ? 'Marka' 
                      : 'Kullanıcı'}
                </p>
                {profile.category && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-[10px] uppercase tracking-wider text-gray-300">
                    {getCategoryLabel(profile.category)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold text-white truncate">{profile.full_name ?? profile.username}</h1>
                {badgeIds.includes('verified-account') && (
                  <div className="group/verify relative flex-shrink-0">
                    <BadgeCheck className={`h-6 w-6 transition-all hover:scale-110 cursor-pointer ${isBrand ? 'text-soft-gold hover:text-soft-gold/80' : 'text-blue-500 hover:text-blue-400'}`} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover/verify:opacity-100 group-hover/verify:visible transition-all duration-200 z-50 pointer-events-none">
                      <div className="whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg border border-white/10">
                        {isBrand ? 'Onaylanmış İşletme' : 'Mavi Tik: seçkin içerik üreticisi'}
                        <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-px">
                          <div className="h-2 w-2 rotate-45 border-r border-b border-white/10 bg-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-base text-gray-400 font-medium mb-4">@{profile.username}</p>

              {profile.bio && (
                <p className="text-sm text-gray-300 leading-relaxed max-w-2xl">
                  {profile.bio}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-300">
                {isInfluencer && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs text-gray-300">
                    <span className="font-semibold text-white">{completedCollaborations}</span>
                    <span>tamamlanan iş birliği</span>
                  </div>
                )}
                {reliability && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs text-gray-300">
                    <span>{reliabilityText(reliability.completed, reliability.confirmed)}</span>
                  </div>
                )}
                {profile.city && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs text-gray-300">
                    <span>📍</span>
                    <span>{profile.city}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Stats & Analysis (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            {instagramData || tiktokData ? (
              <InfluencerStats
                instagramData={instagramData}
                tiktokData={tiktokData}
                mode="brand-view"
                hideAnalysisText={false} // Enable AI analysis here
                subscriptionTier={viewerTier}
                viewerRole={viewerRole ?? undefined}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-glow">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <BadgeCheck className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Veri Doğrulanmadı</h3>
                <p className="mt-2 text-sm text-gray-400 max-w-xs">
                  Bu kullanıcı henüz Instagram veya TikTok verilerini doğrulamadığı için detaylı istatistikler görüntülenemiyor.
                </p>
              </div>
            )}

            {badgeIds.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Rozetler</h3>
                <BadgeDetailList badgeIds={badgeIds} userRole={isInfluencer ? 'influencer' : 'brand'} />
              </div>
            )}
          </div>

          {/* Right Column: Social Media & Actions */}
          <div className="space-y-6">
            {/* Social Media Card */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 h-fit">
              <p className="text-xs uppercase tracking-[0.4em] text-soft-gold mb-4">Sosyal Medya</p>
              {socialLinksEntries.length === 0 ? (
                <p className="text-sm text-gray-400">Sosyal bağlantı paylaşılmamış.</p>
              ) : (
                <ul className="space-y-3">
                  {socialLinksEntries.map(([key, url]) => (
                    <li key={key}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200 transition hover:border-soft-gold hover:text-soft-gold hover:bg-white/10"
                      >
                        <span className="font-semibold">
                          {SOCIAL_LABELS[key] ?? key}
                        </span>
                        <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Git</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isInfluencer && rateCard && <RateCardView rateCard={rateCard} isOwner={isOwnProfile} />}

            {/* Offer CTA (if applicable) */}
            {canSendOffer && (
              <div className="rounded-3xl border border-soft-gold/30 bg-soft-gold/10 p-6 text-center">
                <h3 className="text-lg font-semibold text-white mb-2">İş Birliği Yap</h3>
                <p className="text-sm text-gray-300 mb-4">Bu influencer ile çalışmak için teklif gönder.</p>
                {offerQuotaText && <p className="mb-4 text-xs text-soft-gold">{offerQuotaText}</p>}
                <OfferModal
                  receiverId={profile.id}
                  receiverName={profile.full_name || profile.username || ''}
                  isViewerVerified={isViewerVerified}
                  quotaText={offerQuotaText}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}