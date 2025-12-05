import { redirect } from 'next/navigation'
import { type AdvertProject } from '@/components/dashboard/AdvertProjectsList'
import { type AdvertApplication } from '@/components/dashboard/AdvertApplicationsList'
import InfluencerAdvertTabs from '@/components/dashboard/InfluencerAdvertTabs'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const revalidate = 0

export default async function InfluencerAdvertPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: projectRows, error: projectsError }, { data: applicationRows, error: applicationsError }] = await Promise.all([
    supabase
      .from('advert_projects')
      .select(
        `id, title, summary, category, brand_name, budget_currency, budget_min, budget_max, deliverables, platforms, location, hero_image, deadline, status, created_at, brand_user_id`,
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    supabase
      .from('advert_applications')
      .select(`id, advert_id, influencer_id, cover_letter, deliverable_idea, budget_expectation, status, created_at`)
      .eq('influencer_id', user.id)
      .order('created_at', { ascending: false }),
  ])


  // Fetch brand details separately
  const brandUserIds = new Set<string>()
  projectRows?.forEach((row) => {
    if (row.brand_user_id) brandUserIds.add(row.brand_user_id)
  })

  let brandMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null; displayed_badges: string[] | null; verification_status: string | null }>()
  if (brandUserIds.size > 0) {
    const { data: brandUsers } = await supabase
      .from('users')
      .select('id, full_name, avatar_url, displayed_badges, verification_status')
      .in('id', Array.from(brandUserIds))

    brandMap = new Map(
      brandUsers?.map((u) => [
        u.id,
        {
          id: u.id,
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          displayed_badges: (u.displayed_badges as string[] | null) ?? null,
          verification_status: u.verification_status ?? null,
        },
      ]) ?? [],
    )
  }

  const projects: AdvertProject[] =
    projectRows?.map((row) => {
      const brandUser = row.brand_user_id ? brandMap.get(row.brand_user_id) : null
      return {
        id: row.id,
        title: row.title ?? 'İsimsiz proje',
        summary: row.summary ?? '',
        category: row.category ?? 'Genel',
        brandName: row.brand_name ?? brandUser?.full_name ?? 'Marka',
        brandUserId: row.brand_user_id ?? null,
        brandDisplayedBadges: brandUser?.displayed_badges ?? null,
        brandVerificationStatus: brandUser?.verification_status ?? null,
        budgetCurrency: row.budget_currency ?? 'TRY',
        budgetMin: row.budget_min ?? null,
        budgetMax: row.budget_max ?? null,
        deliverables: Array.isArray(row.deliverables) ? (row.deliverables as string[]) : [],
        platforms: Array.isArray(row.platforms) ? (row.platforms as string[]) : [],
        location: row.location ?? 'Uzaktan',
        heroImage: row.hero_image ?? null,
        deadline: row.deadline ?? null,
        status: row.status ?? 'open',
        createdAt: row.created_at,
        brandAvatar: brandUser?.avatar_url ?? null,
      }
    }) ?? []

  const appliedAdvertIds = (applicationRows ?? []).map((row: any) => row.advert_id).filter(Boolean) as string[]

  // Fetch advert details for applications
  const advertIds = new Set<string>()
  applicationRows?.forEach((row: any) => {
    if (row.advert_id) advertIds.add(row.advert_id)
  })

  let advertMap = new Map<string, { id: string; title: string | null; category: string | null; brand_user_id: string | null }>()
  let brandMapForApplications = new Map<string, { id: string; full_name: string | null; username: string | null; avatar_url: string | null; verification_status: string | null }>()

  if (advertIds.size > 0) {
    const { data: adverts } = await supabase
      .from('advert_projects')
      .select('id, title, category, brand_user_id')
      .in('id', Array.from(advertIds))

    advertMap = new Map(adverts?.map((a) => [a.id, a]) ?? [])

    // Fetch brand details for applications
    const brandIds = new Set<string>()
    adverts?.forEach((a) => {
      if (a.brand_user_id) brandIds.add(a.brand_user_id)
    })

    if (brandIds.size > 0) {
      const { data: brands } = await supabase
        .from('users')
        .select('id, full_name, username, avatar_url, verification_status')
        .in('id', Array.from(brandIds))

      brandMapForApplications = new Map(brands?.map((b) => [b.id, b]) ?? [])
    }
  }

  // Fetch room IDs and check for messages for applications
  const brandIds = Array.from(brandMapForApplications.keys())
  let roomMap = new Map<string, { id: string; hasMessages: boolean }>()
  if (brandIds.length > 0) {
    // Get rooms by brand_id and influencer_id
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, brand_id, influencer_id, advert_application_id')
      .eq('influencer_id', user.id)
      .in('brand_id', brandIds)
      .is('offer_id', null) // Not an offer room

    if (rooms && rooms.length > 0) {
      const roomIds = rooms.map((r: any) => r.id)
      // Check which rooms have messages from brand
      const { data: messages } = await supabase
        .from('messages')
        .select('room_id, sender_id')
        .in('room_id', roomIds)
        .neq('sender_id', user.id) // Messages from brand (not influencer)

      const roomsWithMessages = new Set(messages?.map((m: any) => m.room_id) ?? [])

      // Map rooms to applications by advert_application_id or by brand_id
      applicationRows?.forEach((row: any) => {
        // First try to find by advert_application_id
        let room = rooms.find((r: any) => r.advert_application_id === row.id)

        // If not found, find by brand_id
        if (!room) {
          const advert = row.advert_id ? advertMap.get(row.advert_id) : null
          const brandId = advert?.brand_user_id
          if (brandId) {
            room = rooms.find((r: any) => r.brand_id === brandId && !r.advert_application_id)
          }
        }

        if (room) {
          roomMap.set(row.id, {
            id: room.id,
            hasMessages: roomsWithMessages.has(room.id)
          })
        }
      })
    }
  }

  // Map applications for influencer view
  const myApplications: AdvertApplication[] = (applicationRows ?? []).map((row: any) => {
    const advert = row.advert_id ? advertMap.get(row.advert_id) : null
    const brand = advert?.brand_user_id ? brandMapForApplications.get(advert.brand_user_id) : null
    const roomInfo = roomMap.get(row.id)

    return {
      id: row.id,
      advert_id: row.advert_id,
      advert_title: advert?.title ?? 'İsimsiz İlan',
      advert_category: advert?.category ?? null,
      influencer: {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        username: user.user_metadata?.username ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
      brand: brand ? {
        id: brand.id,
        full_name: brand.full_name ?? null,
        username: brand.username ?? null,
        avatar_url: brand.avatar_url ?? null,
        verification_status: brand.verification_status as 'pending' | 'verified' | 'rejected' | null | undefined,
      } : undefined,
      cover_letter: row.cover_letter ?? null,
      deliverable_idea: row.deliverable_idea ?? null,
      budget_expectation: row.budget_expectation ?? null,
      status: row.status ?? 'pending',
      created_at: row.created_at,
      room_id: roomInfo?.id ?? null,
      has_messages: roomInfo?.hasMessages ?? false,
    }
  })

  const hasError = Boolean(projectsError || applicationsError)
  const errorMessage = projectsError?.message ?? applicationsError?.message ?? null

  if (projectsError) {
    console.error('[InfluencerAdvertPage] projects error', projectsError)
  }
  if (applicationsError) {
    console.error('[InfluencerAdvertPage] applications error', applicationsError)
  }

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#131421] to-[#090A0F] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Advert</p>
        <h1 className="mt-3 text-3xl font-semibold">Marka Projeleri</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-300">
          Açık iş birliklerini incele, sana uygun brieflere başvur ve markalarla ilk teması kur. Başvuruların marka panelinde görünür.
        </p>
      </header>

      {hasError ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-900/20 p-6 text-sm text-red-200">
          <p>İlanlar yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.</p>
          {errorMessage ? <p className="mt-2 text-xs text-red-300">Hata: {errorMessage}</p> : null}
        </div>
      ) : (
        <InfluencerAdvertTabs
          openProjects={projects}
          myApplications={myApplications}
          initialAppliedIds={appliedAdvertIds}
          currentUserId={user.id}
        />
      )}
    </div>
  )
}

