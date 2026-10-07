import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import BrandLockScreen from '@/components/dashboard/BrandLockScreen'
import { dashboardHomeFor, getViewer } from '@/lib/viewer-role'
import { createSupabaseServerClient } from '@/utils/supabase/server'

// Doğrulanmamış markanın açabildiği sayfalar; diğer tüm marka sayfaları kilit ekranı gösterir.
// Kilit burada merkezi: yeni eklenen bir sayfa kontrolü unutsa da kilitli kalır.
const UNVERIFIED_ALLOWED = ['/dashboard/brand', '/dashboard/brand/profile', '/dashboard/brand/settings', '/dashboard/brand/badges']

// Marka paneli yalnızca DB rolü marka (veya admin) olan hesaplara açıktır.
export default async function BrandDashboardLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  if (viewer.role !== 'brand' && viewer.role !== 'admin') redirect(dashboardHomeFor(viewer.role))

  if (viewer.role === 'brand') {
    const pathname = headers().get('x-pathname') ?? ''
    const allowed = UNVERIFIED_ALLOWED.some((p) => pathname === p || (p !== '/dashboard/brand' && pathname.startsWith(`${p}/`)))
    if (!allowed) {
      const supabase = createSupabaseServerClient()
      const { data } = await supabase.from('users').select('verification_status').eq('id', viewer.user.id).maybeSingle()
      const status = data?.verification_status ?? 'pending'
      if (status !== 'verified') {
        return <BrandLockScreen status={status === 'rejected' ? 'rejected' : 'pending'} />
      }
    }
  }

  return <>{children}</>
}
