import { redirect } from 'next/navigation'
import { type AdvertProject } from '@/components/dashboard/AdvertProjectsList'
import { type AdvertApplication } from '@/components/dashboard/AdvertApplicationsList'
import BrandAdvertTabs from '@/components/dashboard/BrandAdvertTabs'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const revalidate = 0

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
    .select('verification_status, spotlight_active')
    .eq('id', user.id)
    .single()

  const verificationStatus = userProfile?.verification_status ?? 'pending'

  const [{ data: allOpenRows, error: openError }, { data: myRows, error: myError }] = await Promise.all([
    supabase
      .from('advert_projects')
      .select(
        `id, title, summary, category, brand_name, budget_currency, budget_min, budget_max, deliverables, platforms, location, hero_image, deadline, status, created_at, brand_user_id`,
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    supabase
      .from('advert_projects')
      .select(
        `id, title, summary, category, brand_name, budget_currency, budget_min, budget_max, deliverables, platforms, location, hero_image, deadline, status, created_at, brand_user_id`,
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
    const result = await supabase
      .from('advert_applications')
      .select(`
        id, 
        advert_id, 
        influencer_id, 
        cover_letter, 
        deliverable_idea, 
        budget_expectation, 
        status, 
        created_at,
        room_id,
        has_messages,
        influencer:influencer_id (
          id,
          full_name,
          username,
          avatar_url,
          verification_status
        ),
        advert:advert_id (
          title,
          category
        )
      `)
      .in('advert_id', myProjectIdsForFilter)
      .order('created_at', { ascending: false })
    applicationRows = result.data
    applicationsError = result.error
  } else {
    // No projects, so no applications
    applicationRows = []
  }

  // Fetch brand details separately for open projects
  const brandUserIds = new Set<string>()
  // Add current user to brand IDs to ensure their profile is fetched
  if (user.id) brandUserIds.add(user.id)

  allOpenRows?.forEach((row) => {
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

  const mapRowToProject = (row: any, isOpenProject = false): AdvertProject => {
    // Always try to find the brand user, whether it's an open project or my project
    const brandUser = row.brand_user_id ? brandMap.get(row.brand_user_id) : null
    return {
      id: row.id,
      title: row.title ?? 'İsimsiz proje',
      summary: row.summary ?? '',
      category: row.category ?? 'Genel',
      brandName: row.brand_name ?? brandUser?.full_name ?? 'Marka',
      brandUserId: row.brand_user_id ?? null, // Include brand_user_id for ownership check
      brandDisplayedBadges: brandUser?.displayed_badges ?? null, // Include brand badges
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
  const myProjectIds = myRows?.map((row) => row.id).filter(Boolean) ?? []

  const myApplications: AdvertApplication[] = (applicationRows ?? []).map((row: any) => ({
    id: row.id,
    advert_id: row.advert_id,
    advert_title: row.advert?.title ?? 'Bilinmeyen İlan',
    advert_category: row.advert?.category ?? null,
    influencer: {
      id: row.influencer?.id ?? row.influencer_id,
      full_name: row.influencer?.full_name ?? null,
      username: row.influencer?.username ?? null,
      avatar_url: row.influencer?.avatar_url ?? null,
      verification_status: row.influencer?.verification_status ?? null,
    },
    // For brand view, we don't necessarily need brand details in the application object 
    // as we are the brand, but we can populate it if needed or leave undefined.
    // The AdvertApplicationsList uses it for Avatar if 'isInfluencerView' is true.
    // Here logic is clearer. 
    cover_letter: row.cover_letter,
    deliverable_idea: row.deliverable_idea,
    budget_expectation: row.budget_expectation,
    status: row.status,
    created_at: row.created_at,
    room_id: row.room_id,
    has_messages: row.has_messages
  }))
  // actually, look at line 4 imports: `import BrandAdvertTabs from '@/components/dashboard/BrandAdvertTabs'`

  // Let's just restore the return block assuming the commented out variables are available.

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#131421] to-[#090A0F] p-6 text-white shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Liderlik</p>
            <h1 className="mt-3 text-3xl font-semibold">İlan Yönetimi</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">
              Yeni iş birlikleri başlat, gelen başvuruları değerlendir ve kampanyalarını yönet.
            </p>
          </div>
          <div className="flex gap-3">
            {/* Action buttons could be here */}
          </div>
        </div>
      </header>

      <BrandAdvertTabs
        myProjects={myProjects}
        communityProjects={openProjects}
        applications={myApplications}
        currentUserId={user.id}
        myProjectIds={myProjectIds}
        verificationStatus={verificationStatus}
        userSpotlightStatus={userProfile?.spotlight_active ?? false}
      />
    </div>
  )
}

