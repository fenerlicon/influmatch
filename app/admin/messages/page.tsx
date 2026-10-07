import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import MessageReportsPanel from '@/components/admin/MessageReportsPanel'


export const revalidate = 0

export default async function AdminMessagesPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Fetch message reports with related data
  // Kullanıcı e-postaları istemci rollerine kapalı; admin ekranı service role ile okur.
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) {
    throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
  }

  const { data: reports, error } = await supabaseAdmin
    .from('message_reports')
    .select(`
      id,
      message_id,
      reporter_user_id,
      reported_user_id,
      room_id,
      reason,
      description,
      status,
      created_at,
      reviewed_at,
      reviewed_by,
      message_snapshot,
      message_removed_at,
      reporter:reporter_user_id(id, full_name, email, role, avatar_url),
      reported:reported_user_id(id, full_name, email, role, avatar_url),
      message:messages(id, content, sender_id, created_at),
      room:rooms(id, brand_id, influencer_id)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching message reports:', error.message)
  }

  return <MessageReportsPanel initialReports={(reports as any) ?? []} />
}

