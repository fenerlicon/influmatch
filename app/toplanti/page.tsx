import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ContentPlanBoard from '@/components/content-plan/ContentPlanBoard'
import SignOutButton from '@/components/content-plan/SignOutButton'
import { Notice } from '@/components/ui'
import { CONTENT_PLAN_OWNER_ID, loadContentPlan } from '@/lib/content-plan'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const revalidate = 0
export const metadata: Metadata = { title: 'İçerik Planı', robots: { index: false, follow: false } }

// Yalnızca plan sahibinin hesabı açar; başka hesaplara sayfa yokmuş gibi davranılır, adminler takip ekranına gider.
// Girişsiz istek middleware'de /login'e döner.
export default async function ToplantiPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/login?redirectedFrom=/toplanti')
  if (viewer.role === 'admin') redirect('/admin/icerik-plani')
  if (viewer.user.id !== CONTENT_PLAN_OWNER_ID) notFound()

  const admin = createSupabaseAdminClient()
  let plan: Awaited<ReturnType<typeof loadContentPlan>> | null = null
  if (admin) {
    try {
      plan = await loadContentPlan(admin)
    } catch (error) {
      console.error('[toplanti] plan yüklenemedi', error)
    }
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-background/85 px-4 backdrop-blur-md lg:px-7">
        <span className="text-[15px] font-bold tracking-[0.02em] text-ink">
          INFLU<span className="text-gold">MATCH</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Link href={dashboardHomeFor(viewer.role)} className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
            Panele dön
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:px-7">
        {plan ? (
          <ContentPlanBoard series={plan.series} items={plan.items} />
        ) : (
          <Notice tone="danger" title="Plan yüklenemedi.">
            Sayfayı yenileyip tekrar deneyin.
          </Notice>
        )}
      </main>
    </div>
  )
}
