import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ContentPlanBoard from '@/components/content-plan/ContentPlanBoard'
import AppShell from '@/components/shell/AppShell'
import { Notice } from '@/components/ui'
import { CONTENT_PLAN_OWNER_ID, loadContentPlan } from '@/lib/content-plan'
import { SHELL_USER_COLUMNS, buildShellUser } from '@/lib/shell-user'
import { getViewer } from '@/lib/viewer-role'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const revalidate = 0
export const metadata: Metadata = { title: 'Toplantı', robots: { index: false, follow: false } }

// Yalnızca plan sahibinin hesabı açar; başka hesaplara sayfa yokmuş gibi davranılır, adminler takip ekranına gider.
// Girişsiz istek middleware'de /login'e döner. Sayfa panel kabuğunda açılır (menü: nav-config navGroupsFor).
export default async function ToplantiPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/login?redirectedFrom=/toplanti')
  if (viewer.role === 'admin') redirect('/admin/icerik-plani')
  if (viewer.user.id !== CONTENT_PLAN_OWNER_ID) notFound()

  const admin = createSupabaseAdminClient()
  const { data: row } = await createSupabaseServerClient().from('users').select(SHELL_USER_COLUMNS).eq('id', viewer.user.id).maybeSingle()
  let plan: Awaited<ReturnType<typeof loadContentPlan>> | null = null
  if (admin) {
    try {
      plan = await loadContentPlan(admin)
    } catch (error) {
      console.error('[toplanti] plan yüklenemedi', error)
    }
  }

  return (
    <AppShell user={buildShellUser(viewer.user, row)}>
      {plan ? (
        <ContentPlanBoard series={plan.series} items={plan.items} />
      ) : (
        <Notice tone="danger" title="Plan yüklenemedi.">
          Sayfayı yenileyip tekrar deneyin.
        </Notice>
      )}
    </AppShell>
  )
}
