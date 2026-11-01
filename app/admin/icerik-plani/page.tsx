import ContentPlanBoard from '@/components/content-plan/ContentPlanBoard'
import { Notice } from '@/components/ui'
import { loadContentPlan } from '@/lib/content-plan'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const revalidate = 0

// Yetki: app/admin/layout.tsx (yalnızca admin). Damla Dalay'ın planını salt okunur gösterir; düzenleme /toplanti'da.
export default async function AdminContentPlanPage() {
  const admin = createSupabaseAdminClient()
  let plan: Awaited<ReturnType<typeof loadContentPlan>> | null = null
  if (admin) {
    try {
      plan = await loadContentPlan(admin)
    } catch (error) {
      console.error('[admin/icerik-plani] plan yüklenemedi', error)
    }
  }

  if (!plan) {
    return (
      <Notice tone="danger" title="Plan yüklenemedi.">
        Sayfayı yenileyip tekrar deneyin.
      </Notice>
    )
  }
  return <ContentPlanBoard series={plan.series} items={plan.items} readOnly />
}
