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
    .select('verification_status')
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
      .select(`id, advert_id, influencer_id, cover_letter, deliverable_idea, budget_expectation, status, created_at`)
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
    const brandUser = isOpenProject && row.brand_user_id ? brandMap.get(row.brand_user_id) : null
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
  
  // Fetch advert and influencer details separately for applications
  const advertIds = new Set<string>()
  const influencerIds = new Set<string>()
  applicationRows?.forEach((row: any) => {
    if (row.advert_id) advertIds.add(row.advert_id)
    if (row.influencer_id) influencerIds.add(row.influencer_id)
  })

  let advertMap = new Map<string, { id: string; title: string | null; category: string | null }>()
  if (advertIds.size > 0) {
    const { data: adverts } = await supabase
      .from('advert_projects')
      .select('id, title, category')
      .in('id', Array.from(advertIds))
    
    advertMap = new Map(adverts?.map((a) => [a.id, a]) ?? [])
  }

  let influencerMap = new Map<string, { id: string; full_name: string | null; username: string | null; avatar_url: string | null }>()
  if (influencerIds.size > 0) {
    const { data: influencers } = await supabase
      .from('users')
      .select('id, full_name, username, avatar_url')
      .in('id', Array.from(influencerIds))
    
    influencerMap = new Map(influencers?.map((i) => [i.id, i]) ?? [])
  }
  
  // Fetch room IDs for applications
  const applicationIds = (applicationRows ?? []).map((row: any) => row.id).filter(Boolean)
  let roomMap = new Map<string, string>()
  if (applicationIds.length > 0) {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, advert_application_id')
      .in('advert_application_id', applicationIds)
    
    if (rooms) {
      rooms.forEach((room: any) => {
        if (room.advert_application_id) {
          roomMap.set(room.advert_application_id, room.id)
        }
      })
    }
  }

  // Map applications
  const applications: AdvertApplication[] = (applicationRows ?? []).map((row: any) => {
    const advert = row.advert_id ? advertMap.get(row.advert_id) : null
    const influencer = row.influencer_id ? influencerMap.get(row.influencer_id) : null
    
    return {
      id: row.id,
      advert_id: row.advert_id,
      advert_title: advert?.title ?? 'İsimsiz İlan',
      advert_category: advert?.category ?? null,
      influencer: {
        id: influencer?.id ?? row.influencer_id ?? '',
        full_name: influencer?.full_name ?? null,
        username: influencer?.username ?? null,
        avatar_url: influencer?.avatar_url ?? null,
      },
      cover_letter: row.cover_letter ?? null,
      deliverable_idea: row.deliverable_idea ?? null,
      budget_expectation: row.budget_expectation ?? null,
      status: row.status ?? 'pending',
      created_at: row.created_at,
      room_id: roomMap.get(row.id) ?? null,
    }
  })
  
  const hasError = Boolean(openError || myError || applicationsError)
  const errorMessage = openError?.message ?? myError?.message ?? applicationsError?.message ?? null

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#131421] to-[#090a0f] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Advert</p>
        <h1 className="mt-3 text-3xl font-semibold">İş Birliği İlanları</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-300">
          Açık brieflerini yönet, yeni ilan ekle ve topluluğa görünür kıl. Bu ekranda hem toplulukta yayınlanan açık ilanları hem de sana ait
          kampanyaları görebilirsin.
        </p>
      </header>

      {hasError ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-900/20 p-6 text-sm text-red-200">
          <p>İlan verileri yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.</p>
          {errorMessage ? <p className="mt-2 text-xs text-red-300">Hata: {errorMessage}</p> : null}
        </div>
      ) : (
        <BrandAdvertTabs 
          myProjects={myProjects} 
          communityProjects={openProjects}
          applications={applications}
          currentUserId={user.id}
          myProjectIds={myProjectIds}
          verificationStatus={verificationStatus}
        />
      )}
    </div>
  )
}

