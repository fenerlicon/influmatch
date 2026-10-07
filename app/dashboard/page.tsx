import { redirect } from 'next/navigation'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'

export default async function DashboardPage() {
  const viewer = await getViewer()
  if (!viewer) {
    redirect('/login')
  }
  redirect(dashboardHomeFor(viewer.role))
}
