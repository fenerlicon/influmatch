import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import { SHELL_USER_COLUMNS, buildShellUser } from '@/lib/shell-user'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'
import { createSupabaseServerClient } from '@/utils/supabase/server'

// Admin bölümü yalnızca DB rolü admin olan hesaplara açıktır. Sayfalardaki kontroller ve
// aksiyonlardaki yetki kontrolleri ayrıca sürer; bu katman unutulan sayfayı da kapatır
// (ör. istemci bileşeni olan /admin/manual-connect). Sayfalar panel kabuğunda açılır (menü: nav-config ADMIN).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  if (viewer.role !== 'admin') redirect(dashboardHomeFor(viewer.role))

  const { data: row } = await createSupabaseServerClient()
    .from('users')
    .select(SHELL_USER_COLUMNS)
    .eq('id', viewer.user.id)
    .maybeSingle()

  return <AppShell user={buildShellUser(viewer.user, row)}>{children}</AppShell>
}
