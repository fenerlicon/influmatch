import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Briefcase, Eye, Inbox, Megaphone } from 'lucide-react'
import AccountStatusCard, { type StatusStep } from '@/components/dashboard/AccountStatusCard'
import OfferActionButtons from '@/components/dashboard/OfferActionButtons'
import { Avatar, ButtonLink, Card, CardHeader, Chip, EmptyState, ListRow, PageHeader, StatCard, VerifiedTick } from '@/components/ui'
import { BLUE_TICK_BADGE_ID, evaluateBlueTick, type BlueTickAccount } from '@/lib/blue-tick-rules'
import { loadOwnBlueTickPromo } from '@/lib/tasks'
import { listCollaborationsFor } from '@/lib/collaborations'
import { COLLABORATION_STATUS_LABELS } from '@/lib/collaboration-shared'
import { getFirstStepsStatus } from '@/lib/first-steps'
import { OFFER_EXPIRY_DAYS, effectiveOfferStatus } from '@/lib/offer-shared'
import { getProfileViewStats } from '@/lib/profile-views'
import { refreshIfStale } from '@/lib/social-stats'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { ACTIVE_COLLAB_STATUSES, COLLABORATION_TONES, collaborationNextStep, countWorks, greetingFor, loadIncomingOffers, worksHref } from '@/lib/works'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { advertCategoryLabel, advertFitsCategory, getCategoryLabel } from '@/utils/categories'

export const revalidate = 0

const tl = (n: number | null | undefined) =>
  n == null ? 'Belirlenmedi' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

// Influencer ana sayfası (docs/REDESIGN.md, 3. aşama): özet sayılar, yanıt bekleyen teklifler, süren işler,
// yeni ilanlar ve tek "Hesap durumu" kartı. İstatistik ayrıntıları İstatistikler sayfasında.
export default async function InfluencerDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: accounts }, { data: blueTickBadge }, firstSteps, offersResult, collabResult, { data: advertRows }] = await Promise.all([
    supabase
      .from('users')
      .select('spotlight_active, spotlight_plan, spotlight_expires_at, is_showcase_visible, full_name, username, avatar_url, category, verification_status')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('social_accounts')
      .select('platform, username, follower_count, engagement_rate, stats_payload, updated_at, has_stats, is_verified, last_scraped_at')
      .eq('user_id', user.id)
      .in('platform', ['instagram', 'tiktok']),
    supabase.from('user_badges').select('id').eq('user_id', user.id).eq('badge_id', BLUE_TICK_BADGE_ID).maybeSingle(),
    getFirstStepsStatus(supabase, user.id),
    loadIncomingOffers(supabase, user.id, 30),
    listCollaborationsFor(supabase, user.id),
    supabase
      .from('advert_projects')
      .select('id, title, brand_name, budget_min, budget_max, platforms, category, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  // Kategorine uygun ilanlar önce (aynı kategori ya da "Genel", 3.7-S5), sonra en yeniler; ilk 3.
  const myCategory = (profile?.category as string | null) ?? null
  const fitting = (advertRows ?? []).filter((ad) => advertFitsCategory(ad.category as string | null, myCategory))
  const adverts = [...fitting, ...(advertRows ?? []).filter((ad) => !fitting.includes(ad))].slice(0, 3)

  // Takipçi verisi eskiyse arka planda yenilenir (sayfayı bekletmez); önceki davranışla aynı.
  if (profile?.username) {
    refreshIfStale(user.id, 'instagram').catch((err: unknown) => console.error('AutoRefresh Instagram Error:', err))
    if ((accounts ?? []).some((a) => a.platform === 'tiktok')) {
      refreshIfStale(user.id, 'tiktok').catch((err: unknown) => console.error('AutoRefresh TikTok Error:', err))
    }
  }

  const verificationStatus = profile?.verification_status ?? 'pending'
  // Süresi dolmuş plan saatlik görev kapatana kadar da aktif sayılmaz; görüntülenme yalnızca Spotlight üyesine.
  const spotlightActive = hasActiveSpotlight(profile) && verificationStatus === 'verified'
  const adminClient = spotlightActive ? createSupabaseAdminClient() : null
  const viewStats = adminClient ? await getProfileViewStats(adminClient, user.id) : null

  // Mavi tik: Spotlight + performans + güven kuralı (lib/blue-tick-rules.ts); güven skoru da buradan.
  const blueTick = evaluateBlueTick(
    {
      id: user.id,
      full_name: profile?.full_name ?? null,
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
      category: profile?.category ?? null,
      spotlight_active: profile?.spotlight_active ?? false,
      spotlight_expires_at: profile?.spotlight_expires_at ?? null,
    },
    (accounts ?? []) as BlueTickAccount[],
    Date.now(),
    // 0₺ dönemi: tanıtım görevi + tamamlanan iş birliği şartı (lib/tasks-promo.ts); kapalıyken null.
    await loadOwnBlueTickPromo(user.id),
  )

  const collaborations = collabResult.success ? collabResult.collaborations : []
  const counts = countWorks(offersResult.offers, collaborations)
  const pendingOffers = offersResult.offers.filter((o) => effectiveOfferStatus(o) === 'pending').slice(0, 3)
  const activeWorks = collaborations.filter((c) => ACTIVE_COLLAB_STATUSES.includes(c.status)).slice(0, 3)
  const inFlight = counts.agreed + counts.in_progress + counts.published

  // Hesap durumu adımları: ilk adımlar + (tek platform doğrulandıysa) diğerini doğrulama, isteğe bağlı.
  const verifiedPlatforms = new Set((accounts ?? []).filter((a) => a.is_verified).map((a) => a.platform))
  const steps: StatusStep[] = (firstSteps?.steps ?? []).map((s) => ({ ...s }))
  if (verifiedPlatforms.size === 1) {
    const missing = verifiedPlatforms.has('instagram') ? 'TikTok' : 'Instagram'
    steps.push({
      key: 'second_platform',
      title: `${missing} hesabını da doğrula`,
      description: 'İki platform da doğrulanınca markalar iki hesabının istatistiğini de görür.',
      done: false,
      href: '/dashboard/influencer/profile#hesaplar',
      optional: true,
    })
  }

  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0]
  const summaryParts = [counts.offers > 0 ? `${counts.offers} teklif yanıtını bekliyor` : null, inFlight > 0 ? `${inFlight} iş sürüyor` : null].filter(Boolean)
  const summary = summaryParts.length ? `${summaryParts.join(', ')}.` : 'Şu an seni bekleyen bir iş yok. Yeni ilanlara göz atabilirsin.'

  return (
    <div>
      <PageHeader
        title={firstName ? `${greetingFor()}, ${firstName}` : greetingFor()}
        description={summary}
        actions={
          profile?.username ? (
            <ButtonLink href={`/profile/${profile.username}`} leftIcon={<Eye />}>
              Profilimi gör
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bekleyen teklif" value={counts.offers} detail={`${OFFER_EXPIRY_DAYS} gün içinde yanıtlanmalı`} />
        <StatCard label="Süren iş" value={inFlight} detail={counts.published > 0 ? `${counts.published} tanesi marka onayında` : 'Anlaşma ve içerik'} />
        <StatCard label="Tamamlanan iş" value={counts.completed} detail="Profilinde görünür" />
        {spotlightActive && viewStats ? (
          <StatCard label="Profil görüntülenme" value={viewStats.last30} detail={`Son 30 gün · ${viewStats.brandViewers30} marka`} />
        ) : (
          <Link href="/dashboard/spotlight/influencer" className="rounded-2xl border border-line bg-surface-1 px-[18px] py-4 transition-colors hover:border-gold/30">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">Profil görüntülenme</div>
            <div className="mt-1.5 text-[26px] font-semibold text-ink-faint">—</div>
            <div className="mt-0.5 text-xs text-gold">Spotlight ile görünür</div>
          </Link>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Card as="section">
            <CardHeader
              title="Yanıt bekleyen teklifler"
              description={`Yanıtlanmayan teklif ${OFFER_EXPIRY_DAYS} gün sonra düşer.`}
              action={
                <ButtonLink href={worksHref('offers')} variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                  Tümü
                </ButtonLink>
              }
            />
            {pendingOffers.length === 0 ? (
              <EmptyState icon={Inbox} title="Bekleyen teklif yok" description="Markalar teklif gönderdiğinde burada görürsün." />
            ) : (
              pendingOffers.map((offer) => {
                const left = Math.max(0, OFFER_EXPIRY_DAYS - Math.floor((Date.now() - Date.parse(offer.created_at)) / 86_400_000))
                return (
                  <ListRow key={offer.id}>
                    <Avatar name={offer.sender?.full_name} src={offer.sender?.avatar_url} square />
                    <div className="min-w-0 flex-[1_1_200px]">
                      <div className="truncate text-[13.5px] font-medium text-ink">
                        {offer.sender?.full_name ?? 'Marka'} · {offer.campaign_name ?? 'İsimsiz kampanya'}{' '}
                        {offer.sender?.displayed_badges?.includes('official-business') && <VerifiedTick tone="gold" label="Resmi işletme" />}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {offer.campaign_type ? `${offer.campaign_type} · ` : ''}
                        {offer.payment_type === 'barter' ? 'Barter' : tl(offer.budget)}
                        {offer.edited_at ? ' · düzenlendi' : ''}
                      </div>
                    </div>
                    <Chip tone={left <= 2 ? 'warning' : 'neutral'} dot>
                      {left} gün kaldı
                    </Chip>
                    <div className="ml-auto">
                      <OfferActionButtons offerId={offer.id} editedAt={offer.edited_at ?? null} />
                    </div>
                  </ListRow>
                )
              })
            )}
          </Card>

          <Card as="section">
            <CardHeader
              title="Süren işler"
              action={
                <ButtonLink href={worksHref('active')} variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                  İşlere git
                </ButtonLink>
              }
            />
            {activeWorks.length === 0 ? (
              <EmptyState icon={Briefcase} title="Süren iş yok" description="Kabul ettiğin teklifler ve kabul edilen başvuruların burada iş olarak takip edilir." />
            ) : (
              activeWorks.map((work) => (
                <ListRow key={work.id}>
                  <Avatar name={work.other?.full_name} src={work.other?.avatar_url} square />
                  <div className="min-w-0 flex-[1_1_200px]">
                    <Link href={`/dashboard/collaborations/${work.id}`} className="block truncate text-[13.5px] font-medium text-ink hover:text-gold">
                      {work.other?.full_name ?? 'Marka'} · {work.title}
                    </Link>
                    <div className="text-xs text-ink-faint">{collaborationNextStep(work, 'influencer', user.id)}</div>
                  </div>
                  <Chip tone={COLLABORATION_TONES[work.status]} dot>
                    {COLLABORATION_STATUS_LABELS[work.status]}
                  </Chip>
                </ListRow>
              ))
            )}
          </Card>

          <Card as="section">
            <CardHeader
              title={fitting.length ? 'Kategorine uygun ilanlar' : 'Yeni ilanlar'}
              description={fitting.length && myCategory ? `${getCategoryLabel(myCategory)} ve genel ilanlar önce` : 'Markaların en yeni açık ilanları'}
              action={
                <ButtonLink href="/dashboard/influencer/advert" variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                  İlanlar
                </ButtonLink>
              }
            />
            {(adverts ?? []).length === 0 ? (
              <EmptyState icon={Megaphone} title="Şu an açık ilan yok" description="Yeni ilan çıkınca haber almak için İlanlar sayfasından alarm kurabilirsin." />
            ) : (
              (adverts ?? []).map((ad) => (
                <ListRow key={ad.id}>
                  <Avatar name={ad.brand_name} square />
                  <Link href="/dashboard/influencer/advert" className="min-w-0 flex-[1_1_200px]">
                    <div className="truncate text-[13.5px] font-medium text-ink hover:text-gold">{ad.title}</div>
                    <div className="truncate text-xs text-ink-faint">
                      {ad.brand_name ?? 'Marka'}
                      {` · ${advertCategoryLabel(ad.category as string | null)}`}
                      {Array.isArray(ad.platforms) && ad.platforms.length ? ` · ${(ad.platforms as string[]).join(', ')}` : ''}
                    </div>
                  </Link>
                  <div className="ml-auto text-[13px] font-semibold tabular-nums text-ink">
                    {ad.budget_min && ad.budget_max && ad.budget_min !== ad.budget_max
                      ? `${tl(ad.budget_min)}–${tl(ad.budget_max)}`
                      : ad.budget_max || ad.budget_min
                        ? tl(ad.budget_max ?? ad.budget_min)
                        : 'Bütçe belirtilmedi'}
                  </div>
                </ListRow>
              ))
            )}
          </Card>
        </div>

        <aside className="grid gap-4">
          <AccountStatusCard
            steps={steps}
            doneTitle="Hesabın hazır"
            trustScore={blueTick.trustScore}
            blueTick={{ has: !!blueTickBadge, criteria: blueTick.criteria }}
            showcase={{
              visible: profile?.is_showcase_visible ?? true,
              disabledReason: verificationStatus !== 'verified' ? 'Hesabın onaylanınca açabilirsin.' : null,
            }}
          />
          {!spotlightActive && (
            <Card accent padded as="section">
              <div className="text-[15px] font-semibold text-gold">Spotlight</div>
              <p className="mb-3.5 mt-1.5 text-[12.5px] text-ink-muted">Keşfet’te öncelikli listelen, profilini kimlerin incelediğini gör.</p>
              <ButtonLink href="/dashboard/spotlight/influencer" size="sm">
                Paketleri gör
              </ButtonLink>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
