import { redirect } from 'next/navigation'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import WorksView from '@/components/dashboard/WorksView'
import { listCollaborationsFor } from '@/lib/collaborations'
import { WORK_STAGES, countWorks, loadIncomingOffers, loadSentOffers, type WorkStage } from '@/lib/works'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const revalidate = 0

// İşler: teklifler + iş birlikleri tek sayfada (docs/REDESIGN.md, 3. aşama).
// Eski /dashboard/offers, /dashboard/brand/offers ve /dashboard/collaborations buraya yönlenir.
export default async function WorksPage({ searchParams }: { searchParams: { stage?: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('users').select('role, verification_status').eq('id', user.id).maybeSingle()
  const role = me?.role === 'brand' ? 'brand' : me?.role === 'influencer' ? 'influencer' : null
  if (!role) redirect('/dashboard')

  // Marka paneli kilidi /dashboard/brand altında; bu sayfa onun dışında olduğu için burada da uygulanır.
  if (role === 'brand' && me?.verification_status !== 'verified') {
    return <BrandLockScreen status={me?.verification_status === 'rejected' ? 'rejected' : 'pending'} />
  }

  const collabResult = await listCollaborationsFor(supabase, user.id)
  const collaborations = collabResult.success ? collabResult.collaborations : []
  const collabError = collabResult.success ? null : collabResult.error
  const requested = WORK_STAGES.includes(searchParams.stage as WorkStage) ? (searchParams.stage as WorkStage) : null

  if (role === 'influencer') {
    const { offers, dismissedOfferIds } = await loadIncomingOffers(supabase, user.id)
    const counts = countWorks(offers, collaborations)
    const inFlight = counts.agreed + counts.in_progress + counts.published
    // Varsayılan: yanıt bekleyen teklif varsa teklifler, yoksa süren işler.
    const stage: WorkStage = requested ?? (counts.offers > 0 ? 'offers' : inFlight > 0 ? 'active' : 'offers')
    return (
      <WorksView
        role="influencer"
        userId={user.id}
        stage={stage}
        counts={counts}
        offers={offers}
        dismissedOfferIds={dismissedOfferIds}
        collaborations={collaborations}
        collabError={collabError}
      />
    )
  }

  const { offers, dismissedReceiverIds } = await loadSentOffers(supabase, user.id)
  const counts = countWorks(offers, collaborations)
  const inFlight = counts.agreed + counts.in_progress + counts.published
  const stage: WorkStage = requested ?? (inFlight > 0 ? 'active' : 'offers')
  return (
    <WorksView
      role="brand"
      userId={user.id}
      stage={stage}
      counts={counts}
      offers={offers}
      dismissedReceiverIds={dismissedReceiverIds}
      collaborations={collaborations}
      collabError={collabError}
    />
  )
}
