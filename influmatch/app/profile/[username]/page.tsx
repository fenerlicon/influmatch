import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, BadgeCheck } from 'lucide-react'
import OfferModal from '@/components/profile/OfferModal'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import BadgeDetailList from '@/components/badges/BadgeDetailList'
import { influencerBadges, brandBadges } from '@/app/badges/data'
import { getCategoryLabel } from '@/utils/categories'

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

  // Get all badge IDs for this user (only pass IDs, not badge objects)
  const badgeIds = userBadges?.map((ub) => ub.badge_id).filter((id): id is string => typeof id === 'string') ?? []

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-white sm:px-8 lg:px-20">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#15161F] to-[#0C0D10] p-6 sm:p-10 shadow-glow">
          <Link
            href="/dashboard/brand/discover"
            className="group absolute -left-3 -top-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur transition hover:border-soft-gold hover:text-soft-gold lg:-left-4 lg:-top-4"
          >
            <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
          </Link>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
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
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">
                  {isInfluencer ? 'Influencer' : isBrand ? 'Marka' : 'Kullanıcı'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h1 className="text-3xl font-semibold">{profile.full_name ?? profile.username}</h1>
                  {profile.verification_status === 'verified' && (
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
                <p className="text-sm text-gray-400">@{profile.username}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-300">
                  {profile.city && (
                    <span className="rounded-full border border-white/15 px-3 py-1">
                      {profile.city}
                    </span>
                  )}
                  {profile.category && (
                    <span className="rounded-full border border-white/15 px-3 py-1">
                      {getCategoryLabel(profile.category)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {canSendOffer ? (
              <OfferModal receiverId={profile.id} receiverName={profile.full_name ?? profile.username ?? 'Influencer'} />
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Hakkında</p>
            <p className="mt-4 text-gray-200">{profile.bio ?? 'Henüz biyografi eklenmedi.'}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Sosyal Medya</p>
            {socialLinksEntries.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">Sosyal bağlantı paylaşılmamış.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {socialLinksEntries.map(([key, url]) => (
                  <li key={key}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm text-gray-200 transition hover:border-soft-gold hover:text-soft-gold"
                    >
                      <span className="font-semibold">
                        {SOCIAL_LABELS[key] ?? key}
                      </span>
                      <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Ziyaret Et</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {badgeIds.length > 0 && (
          <BadgeDetailList badgeIds={badgeIds} userRole={isInfluencer ? 'influencer' : 'brand'} />
        )}
      </div>
    </main>
  )
}