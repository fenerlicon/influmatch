import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, BadgeCheck } from 'lucide-react'
import OfferModal from '@/components/profile/OfferModal'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import BadgeDetailList from '@/components/badges/BadgeDetailList'
import { getCategoryLabel } from '@/utils/categories'
import InfluencerStats from '@/components/profile/InfluencerStats'

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

  const [{ data: profile, error }, authResponse] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, username, avatar_url, city, category, bio, social_links, role, verification_status')
      .eq('username', params.username)
      .single(),
    supabase.auth.getUser(),
  ])

  if (error || !profile) {
    notFound()
  }

  // Fetch social account stats
  const { data: socialAccount } = await supabase
    .from('social_accounts')
    .select('follower_count, engagement_rate, stats_payload, updated_at, has_stats')
    .eq('user_id', profile.id)
    .eq('platform', 'instagram') // Assuming primary platform is Instagram for now
    .single()

  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', profile.id)

  const viewer = authResponse.data.user
  const viewerRole = (viewer?.user_metadata?.role as 'brand' | 'influencer' | undefined) ?? null
  const isInfluencer = profile.role === 'influencer'
  const isBrand = profile.role === 'brand'
  const canSendOffer = viewerRole === 'brand' && isInfluencer && viewer?.id !== profile.id

  const socialLinksEntries = Object.entries((profile.social_links as Record<string, string> | null) ?? {}).filter(
    ([, value]) => Boolean(value),
  )

  // Determine Viewer's Tier
  let viewerTier: 'FREE' | 'SPOTLIGHT' | 'SPOTLIGHT_PLUS' | 'BRAND_PRO' = 'FREE'
  if (viewer) {
    if (viewerRole === 'brand') {
      viewerTier = 'BRAND_PRO' // Brands get Pro features for analysis
    } else {
      // Check if viewer has spotlight
      const { data: viewerProfile } = await supabase
        .from('users')
        .select('spotlight_active, verification_status')
        .eq('id', viewer.id)
        .single()

      if (viewerProfile?.spotlight_active && viewerProfile?.verification_status === 'verified') {
        viewerTier = 'SPOTLIGHT'
      }
    }
  }

  // Get all badge IDs for this user (only pass IDs, not badge objects)
  const badgeIds = userBadges?.map((ub) => ub.badge_id).filter((id): id is string => typeof id === 'string') ?? []

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-white sm:px-8 lg:px-20">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Profile Card */}
        <section className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#15161F] to-[#0C0D10] p-6 sm:p-10 shadow-glow">
          <Link
            href="/dashboard/brand/discover"
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
                  {isInfluencer ? 'Influencer' : isBrand ? 'Marka' : 'Kullanıcı'}
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
                        {isBrand ? 'Onaylanmış İşletme' : 'Onaylı hesap'}
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
            {socialAccount && socialAccount.has_stats ? (
              <InfluencerStats
                followerCount={socialAccount.follower_count || 0}
                engagementRate={Number(socialAccount.engagement_rate) || 0}
                statsPayload={socialAccount.stats_payload as any}
                lastUpdated={socialAccount.updated_at || new Date().toISOString()}
                mode="brand-view"
                hideAnalysisText={false} // Enable AI analysis here
                subscriptionTier={viewerTier}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-glow">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <BadgeCheck className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Veri Doğrulanmadı</h3>
                <p className="mt-2 text-sm text-gray-400 max-w-xs">
                  Bu kullanıcı henüz Instagram verilerini doğrulamadığı için detaylı istatistikler görüntülenemiyor.
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

            {/* Offer CTA (if applicable) */}
            {canSendOffer && (
              <div className="rounded-3xl border border-soft-gold/30 bg-soft-gold/10 p-6 text-center">
                <h3 className="text-lg font-semibold text-white mb-2">İş Birliği Yap</h3>
                <p className="text-sm text-gray-300 mb-4">Bu influencer ile çalışmak için teklif gönder.</p>
                <OfferModal
                  receiverId={profile.id}
                  receiverName={profile.full_name || profile.username || ''}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}