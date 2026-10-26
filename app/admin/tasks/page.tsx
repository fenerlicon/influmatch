export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { loadAdminTasksDashboard } from '@/lib/tasks'
import AdminTasksPanel from '@/components/tasks/admin/AdminTasksPanel'
import FounderBadgeCard from '@/components/tasks/admin/FounderBadgeCard'
import { loadFounderCutoff } from '@/lib/founder-badge'
import { FOUNDER_BADGE_ID } from '@/lib/founder-badge-shared'

export default async function AdminTasksPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') redirect('/dashboard')

  // Görev tabloları istemci rollerine kapalı; yalnızca service role okur.
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')

  const [data, cutoff, holders] = await Promise.all([
    loadAdminTasksDashboard(admin),
    loadFounderCutoff(admin),
    admin.from('user_badges').select('user_id', { count: 'exact', head: true }).eq('badge_id', FOUNDER_BADGE_ID),
  ])

  return (
    <AdminTasksPanel
      data={data}
      extra={
        cutoff.ok ? (
          <FounderBadgeCard cutoff={cutoff.cutoff} holders={holders.error ? null : holders.count ?? 0} />
        ) : null
      }
    />
  )
}
