import { redirect } from 'next/navigation'
import { getBrandApplicationsAdmin } from './actions'
import BrandAdverts from '@/components/adverts/BrandAdverts'
import { parseAnswers, type AdvertApplication, type AdvertProject } from '@/lib/adverts-shared'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getAdvertOwnerCards } from '@/lib/profile-reads'
import { hasActiveSpotlight } from '@/lib/spotlight-access'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function BrandAdvertPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user verification status
  const { data: userProfile } = await supabase
    .from('users')
    .select('verification_status, spotlight_active, spotlight_expires_at')
    .eq('id', user.id)
    .single()

  const verificationStatus = (userProfile?.verification_status ?? 'pending') as 'pending' | 'verified' | 'rejected'

  const [{ data: allOpenRows, error: openError }, { data: myRows, error: myError }] = await Promise.all([
    supabase
      .from('advert_projects')
      .select(
        `id, title, summary, category, brand_name, budget_currency, budget_min, budget_max, deliverables, platforms, location, hero_image, deadline, status, created_at, brand_user_id, payment_type, custom_questions`,
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    supabase
      .from('advert_projects')
      .select(
        `id, title, summary, category, brand_name, budget_currency, budget_min, budget_max, deliverables, platforms, location, hero_image, deadline, status, created_at, brand_user_id, payment_type, custom_questions`,
      )
      .eq('brand_user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  // Get this brand's project IDs to filter applications
  const myProjectIdsForFilter = myRows?.map((row) => row.id).filter(Boolean) ?? []

  // Fetch applications only for this brand's projects
  let applicationRows: any[] | null = null
  let applicationsError: any = null

  if (myProjectIdsForFilter.length > 0) {
    const result = await getBrandApplicationsAdmin(myProjectIdsForFilter)
    applicationRows = result.applications ?? []
    applicationsError = result.error
  } else {
    applicationRows = []
  }

  // Fetch brand details separately for open projects
  const brandUserIds = new Set<string>()
  // Add current user to brand IDs to ensure their profile is fetched
  if (user.id) brandUserIds.add(user.id)

  allOpenRows?.forEach((row) => {
    if (row.brand_user_id) brandUserIds.add(row.brand_user_id)
  })

  let brandMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null; displayed_badges: string[] | null; verification_status: string | null; spotlight_active: boolean }>()
  if (brandUserIds.size > 0) {
    // İlan sahibi kartları sunucuda okunur (başka hesapların satırları oturumla okunamaz, 3.17-S2).
    // Kendi satırı ilanı olmasa da gerekir; o yüzden ayrıca kendi oturumuyla okunur.
    const [ownerCards, { data: ownRow }] = await Promise.all([
      getAdvertOwnerCards<{ id: string; full_name: string | null; avatar_url: string | null; displayed_badges: unknown; verification_status: string | null; spotlight_active: boolean | null; spotlight_expires_at: string | null }>(
        Array.from(brandUserIds),
        'id, full_name, avatar_url, displayed_badges, verification_status, spotlight_active, spotlight_expires_at',
      ),
      supabase
        .from('users')
        .select('id, full_name, avatar_url, displayed_badges, verification_status, spotlight_active, spotlight_expires_at')
        .eq('id', user.id)
        .maybeSingle(),
    ])
    const brandUsers = [...ownerCards.filter((card) => card.id !== user.id), ...(ownRow ? [ownRow] : [])]

    brandMap = new Map(
      brandUsers?.map((u) => [
        u.id,
        {
          id: u.id,
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          displayed_badges: (u.displayed_badges as string[] | null) ?? null,
          verification_status: u.verification_status ?? null,
          spotlight_active: hasActiveSpotlight(u),
        },
      ]) ?? [],
    )
  }

  const mapRowToProject = (row: any, isOpenProject = false): AdvertProject => {
    // Always try to find the brand user, whether it's an open project or my project
    const brandUser = row.brand_user_id ? brandMap.get(row.brand_user_id) : null
    return {
      id: row.id,
      title: row.title ?? 'İsimsiz ilan',
      summary: row.summary ?? '',
      category: row.category ?? 'Genel',
      brandName: row.brand_name ?? brandUser?.full_name ?? 'Marka',
      brandUserId: row.brand_user_id ?? null, // Include brand_user_id for ownership check
      brandDisplayedBadges: brandUser?.displayed_badges ?? null, // Include brand badges
      brandVerificationStatus: brandUser?.verification_status ?? null,
      // Topluluk sekmesi Spotlight markaları öne alır (önceden hiç doldurulmuyordu).
      brandIsSpotlight: brandUser?.spotlight_active ?? false,
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
      paymentType: row.payment_type ?? 'cash',
      customQuestions: Array.isArray(row.custom_questions) ? row.custom_questions : [],
    }
  }

  if (openError) {
    console.error('[BrandAdvertPage] open adverts error', openError)
  }
  if (myError) {
    console.error('[BrandAdvertPage] my adverts error', myError)
  }
  if (applicationsError) {
    console.error('[BrandAdvertPage] applications error', applicationsError)
  }

  // Also log if table might not exist
  if (openError?.code === 'PGRST116' || myError?.code === 'PGRST116') {
    console.error('[BrandAdvertPage] Table might not exist. Please run the schema migration.')
  }

  const openProjects: AdvertProject[] = allOpenRows?.map((row) => mapRowToProject(row, true)) ?? []
  const myProjects: AdvertProject[] = myRows?.map((row) => mapRowToProject(row, false)) ?? []

  // Başvuru sohbet odaları (okunmamış mesaj sayısı için); oda yoksa "Mesaj" ilk tıklamada açar.
  const applicationIds = (applicationRows ?? []).map((row: any) => row.id).filter(Boolean) as string[]
  const roomByApplication = new Map<string, string>()
  if (applicationIds.length > 0) {
    const { data: rooms } = await supabase.from('rooms').select('id, advert_application_id').in('advert_application_id', applicationIds)
    rooms?.forEach((room) => {
      if (room.advert_application_id) roomByApplication.set(room.advert_application_id, room.id)
    })
  }

  const myApplications: AdvertApplication[] = (applicationRows ?? []).map((row: any) => ({
    id: row.id,
    advert_id: row.advert_id,
    advert_title: row.advert?.title ?? 'Bilinmeyen ilan',
    advert_category: row.advert?.category ?? null,
    influencer: {
      id: row.influencer?.id ?? row.influencer_id,
      full_name: row.influencer?.full_name ?? null,
      username: row.influencer?.username ?? null,
      avatar_url: row.influencer?.avatar_url ?? null,
      verification_status: row.influencer?.verification_status ?? null,
      displayed_badges: row.influencer?.displayed_badges ?? null,
    },
    cover_letter: row.cover_letter,
    deliverable_idea: row.deliverable_idea,
    budget_expectation: row.budget_expectation === null || row.budget_expectation === undefined ? null : Number(row.budget_expectation),
    status: row.status,
    created_at: row.created_at,
    room_id: roomByApplication.get(row.id) ?? null,
    answers: parseAnswers(row.answers),
  }))

  return (
    <BrandAdverts
      myProjects={myProjects}
      communityProjects={openProjects}
      applications={myApplications}
      currentUserId={user.id}
      verificationStatus={verificationStatus}
      hasSpotlight={hasActiveSpotlight(userProfile)}
    />
  )
}
