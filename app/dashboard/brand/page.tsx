import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, CheckCircle2, Compass, FileCheck2, Inbox, Link2, Plus, Sparkles } from 'lucide-react'
import AccountStatusCard from '@/components/dashboard/AccountStatusCard'
import { Avatar, ButtonLink, Card, CardHeader, EmptyState, ListRow, PageHeader, StatCard } from '@/components/ui'
import { brandReliability } from '@/lib/collaboration-workspace'
import { listCollaborationsFor } from '@/lib/collaborations'
import { getFirstStepsStatus } from '@/lib/first-steps'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { countWorks, greetingFor, loadSentOffers, worksHref } from '@/lib/works'
import { getAIRecommendations } from '@/utils/fetchInfluencers'
import { getCategoryLabel } from '@/utils/categories'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const revalidate = 0

type Todo = { key: string; icon: typeof Inbox; title: string; detail: string; href: string; cta: string; gold?: boolean }

// Marka ana sayfası (docs/REDESIGN.md, 3. aşama): özet sayılar, "Senden bekleyenler", öneriler ve tek
// "Hesap durumu" kartı. Teklif listesi İşler'de, favoriler kendi sayfasında.
export default async function BrandDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, firstSteps, offersResult, collabResult, { data: myAdverts }, reliabilityMap] = await Promise.all([
    supabase.from('users').select('verification_status, full_name, category, spotlight_active, spotlight_expires_at').eq('id', user.id).maybeSingle(),
    getFirstStepsStatus(supabase, user.id),
    loadSentOffers(supabase, user.id, 100),
    listCollaborationsFor(supabase, user.id),
    supabase.from('advert_projects').select('id, title').eq('brand_user_id', user.id),
    brandReliability(supabase, [user.id]),
  ])

  const verified = profile?.verification_status === 'verified'
  const isSpotlight = hasActiveSpotlight(profile)
  const collaborations = collabResult.success ? collabResult.collaborations : []
  const counts = countWorks(offersResult.offers, collaborations)
  const inFlight = counts.agreed + counts.in_progress + counts.published
  const reliability = reliabilityMap.get(user.id) ?? { completed: 0, confirmed: 0 }

  // Yeni (henüz değerlendirilmemiş) başvurular: markanın ilanlarına gelen "pending" başvurular.
  const advertIds = (myAdverts ?? []).map((a) => a.id)
  const { count: newApplications } = advertIds.length
    ? await supabase.from('advert_applications').select('id', { count: 'exact', head: true }).in('advert_id', advertIds).eq('status', 'pending')
    : { count: 0 }

  // Öneriler yalnızca Spotlight markası için hesaplanır (premium veri sunucuda kontrol edilir).
  const recommendations = verified && isSpotlight ? await getAIRecommendations(user.id, profile?.category ?? null, 4) : []

  // Senden bekleyenler: yalnızca markanın kendisinin yapabileceği / bakması gereken işler.
  const todos: Todo[] = []
  for (const c of collaborations) {
    if (c.actions.includes('approve')) {
      todos.push({
        key: `approve-${c.id}`,
        icon: Link2,
        title: 'Yayın linkini onayla',
        detail: `${c.other?.full_name ?? 'Influencer'} · ${c.title}`,
        href: `/dashboard/collaborations/${c.id}`,
        cta: 'Yayını gör',
        gold: true,
      })
    } else if (c.status === 'agreed' && c.agreement_state === 'pending') {
      todos.push({
        key: `agreement-${c.id}`,
        icon: FileCheck2,
        title: 'Anlaşma özetini kontrol et',
        detail: `${c.other?.full_name ?? 'Influencer'} · ${c.title}`,
        href: `/dashboard/collaborations/${c.id}`,
        cta: 'Özeti aç',
        gold: true,
      })
    }
  }
  if ((newApplications ?? 0) > 0) {
    todos.push({
      key: 'applications',
      icon: Inbox,
      title: `${newApplications} yeni başvuru`,
      detail: 'İlanlarına gelen ve henüz değerlendirmediğin başvurular',
      href: '/dashboard/brand/advert?tab=applications',
      cta: 'Değerlendir',
    })
  }

  const summary = !verified
    ? 'Hesabın inceleniyor. Keşif, ilan ve teklif onaydan sonra açılır.'
    : todos.length > 0
      ? `${todos.length} iş senden yanıt bekliyor.`
      : inFlight > 0
        ? `${inFlight} iş sürüyor, şu an senden beklenen bir şey yok.`
        : 'Keşfet\'ten uygun profilleri bul ya da bir ilan aç.'

  const taxNote = firstSteps?.steps.find((s) => s.key === 'tax_certificate')?.note

  return (
    <div>
      <PageHeader
        title={`${greetingFor()}, ${profile?.full_name ?? 'tekrar hoş geldin'}`}
        description={summary}
        actions={
          verified ? (
            <>
              <ButtonLink href="/dashboard/brand/advert?new=1" leftIcon={<Plus />}>
                İlan aç
              </ButtonLink>
              <ButtonLink href="/dashboard/brand/discover" variant="primary" leftIcon={<Compass />}>
                Keşfet
              </ButtonLink>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Yanıt bekleyen teklif" value={counts.offers} detail="Influencer yanıtı bekleniyor" />
        <StatCard label="Süren iş" value={inFlight} detail={counts.published > 0 ? `${counts.published} tanesi onayını bekliyor` : 'Anlaşma ve içerik'} />
        <StatCard label="Yeni başvuru" value={newApplications ?? 0} detail="İlanlarına gelen" />
        <StatCard label="Tamamlanan iş" value={reliability.completed} detail={`${reliability.confirmed} tanesinde ödeme teyitli`} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Card as="section">
            <CardHeader
              title="Senden bekleyenler"
              action={
                <ButtonLink href={worksHref()} variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                  İşler
                </ButtonLink>
              }
            />
            {todos.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Şu an senden beklenen bir şey yok"
                description={verified ? 'Yeni bir iş başlatmak için Keşfet\'ten teklif gönderebilirsin.' : 'Hesabın onaylanınca işlerin burada görünür.'}
              />
            ) : (
              todos.slice(0, 6).map((t) => (
                <ListRow key={t.key}>
                  <span className={t.gold ? 'grid h-8 w-8 flex-none place-items-center rounded-lg bg-gold/10 text-gold' : 'grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface-3 text-ink-muted'}>
                    <t.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-[1_1_200px]">
                    <div className="truncate text-[13.5px] font-medium text-ink">{t.title}</div>
                    <div className="truncate text-xs text-ink-faint">{t.detail}</div>
                  </div>
                  <ButtonLink href={t.href} size="sm" className="ml-auto">
                    {t.cta}
                  </ButtonLink>
                </ListRow>
              ))
            )}
          </Card>

          {verified &&
            (isSpotlight ? (
              <Card as="section">
                <CardHeader
                  title="Sana önerilenler"
                  description="Sektörün ve marka profiline göre akıllı eşleştirme"
                  action={
                    <ButtonLink href="/dashboard/brand/ai" variant="ghost" size="sm" rightIcon={<ArrowRight />}>
                      Tümü
                    </ButtonLink>
                  }
                />
                {recommendations.length === 0 ? (
                  <EmptyState icon={Sparkles} title="Şu an öneri yok" description="Marka profilinde sektörünü seçtiğinde öneriler burada görünür." />
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
                    {recommendations.map((r) => (
                      <Link
                        key={r.id}
                        href={r.username ? `/profile/${r.username}` : '#'}
                        className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3.5 transition-colors hover:border-line-strong"
                      >
                        <Avatar name={r.full_name} src={r.avatar_url} />
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-medium text-ink">{r.full_name ?? r.username}</div>
                          <div className="truncate text-xs text-ink-faint">
                            {r.category ? getCategoryLabel(r.category) : 'Kategori yok'}
                            {r.stats?.followers ? ` · ${r.stats.followers}` : ''}
                          </div>
                        </div>
                        {typeof r.matchScore === 'number' && (
                          <div className="text-xs text-ink-muted">
                            Uyum <b className="font-semibold text-gold">%{Math.round(r.matchScore)}</b>
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card accent padded as="section" className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[15px] font-semibold text-gold">
                    <Sparkles className="h-4 w-4" aria-hidden /> Sana önerilenler
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-muted">Akıllı eşleştirme önerileri ve uyum skoru Spotlight ile açılır.</p>
                </div>
                <ButtonLink href="/dashboard/spotlight/brand" size="sm">
                  Paketleri gör
                </ButtonLink>
              </Card>
            ))}
        </div>

        <aside className="grid gap-4">
          <AccountStatusCard
            steps={firstSteps?.steps ?? []}
            doneTitle="Onaylı marka"
            badge={
              verified
                ? { tone: 'success', label: 'Onaylı' }
                : { tone: taxNote === 'Reddedildi' ? 'warning' : 'info', label: taxNote === 'Reddedildi' ? 'Vergi levhası reddedildi' : 'İnceleniyor' }
            }
          />
          {verified && (
            <Card padded as="section">
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">Güvenilirliğin</h2>
              <p className="mt-1 text-[12.5px] text-ink-muted">Marka profilinde ve iş ayrıntısında görünür.</p>
              <div className="mt-3 flex gap-6">
                <div>
                  <div className="text-[22px] font-semibold tabular-nums text-ink">{reliability.completed}</div>
                  <div className="text-xs text-ink-faint">iş birliği</div>
                </div>
                <div>
                  <div className="text-[22px] font-semibold tabular-nums text-ink">{reliability.confirmed}</div>
                  <div className="text-xs text-ink-faint">ödeme teyitli</div>
                </div>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
