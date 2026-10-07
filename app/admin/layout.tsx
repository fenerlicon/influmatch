import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'

// Admin bölümü yalnızca DB rolü admin olan hesaplara açıktır. Sayfalardaki kontroller ve
// aksiyonlardaki yetki kontrolleri ayrıca sürer; bu katman unutulan sayfayı da kapatır
// (ör. istemci bileşeni olan /admin/manual-connect).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  if (viewer.role !== 'admin') redirect(dashboardHomeFor(viewer.role))
  return <>{children}</>
}
