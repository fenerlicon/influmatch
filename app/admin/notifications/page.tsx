import NotificationsPanel from '@/components/admin/NotificationsPanel'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export const revalidate = 0

// Yetki: app/admin/layout.tsx (yalnızca admin). E-posta istemci rollerine kapalı; liste service role ile okunur.
export default async function AdminNotificationsPage() {
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, role, username')
    .order('created_at', { ascending: false })

  return <NotificationsPanel users={users ?? []} />
}
