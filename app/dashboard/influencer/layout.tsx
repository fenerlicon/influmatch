import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'

// Influencer paneli yalnızca DB rolü influencer (veya admin) olan hesaplara açıktır.
export default async function InfluencerDashboardLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  if (viewer.role !== 'influencer' && viewer.role !== 'admin') redirect(dashboardHomeFor(viewer.role))
  return <>{children}</>
}
