export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { loadAdminTasksDashboard } from '@/lib/tasks'
import AdminTasksPanel from '@/components/tasks/admin/AdminTasksPanel'

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

  return <AdminTasksPanel data={await loadAdminTasksDashboard(admin)} />
}
