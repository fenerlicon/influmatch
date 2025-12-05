import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import MessageReportsPanel from '@/components/admin/MessageReportsPanel'

const ADMIN_EMAIL = 'admin@influmatch.net'

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
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Fetch message reports with related data
  const { data: reports, error } = await supabase
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

