import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'

// Marka paneli yalnızca DB rolü marka (veya admin) olan hesaplara açıktır.
export default async function BrandDashboardLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  if (viewer.role !== 'brand' && viewer.role !== 'admin') redirect(dashboardHomeFor(viewer.role))
  return <>{children}</>
}
