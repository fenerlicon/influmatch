import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import { SHELL_USER_COLUMNS, buildShellUser } from '@/lib/shell-user'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { countOpenAppeals } from '@/lib/moderation'
import { countEscalatedDisputes } from '@/lib/collaboration-disputes'

// Admin bölümü yalnızca DB rolü admin olan hesaplara açıktır. Sayfalardaki kontroller ve
// aksiyonlardaki yetki kontrolleri ayrıca sürer; bu katman unutulan sayfayı da kapatır
// (ör. istemci bileşeni olan /admin/manual-connect). Sayfalar panel kabuğunda açılır (menü: nav-config ADMIN).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  if (viewer.role !== 'admin') redirect(dashboardHomeFor(viewer.role))

  // Menüde açık itiraz sayısı (2026-10-26; tablo yoksa 0).
  // İncelemedeki anlaşmazlık sayısı (2026-11-23; tablo yoksa 0).
  const [{ data: row }, openAppeals, escalatedDisputes] = await Promise.all([
    createSupabaseServerClient().from('users').select(SHELL_USER_COLUMNS).eq('id', viewer.user.id).maybeSingle(),
    countOpenAppeals(createSupabaseAdminClient()),
    countEscalatedDisputes(createSupabaseAdminClient()).catch(() => 0),
  ])

  return (
    <AppShell user={buildShellUser(viewer.user, row)} navCounts={{ appeals: openAppeals, disputes: escalatedDisputes }}>
      {children}
    </AppShell>
  )
}
