export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import SupportTicketsPanel from '@/components/admin/SupportTicketsPanel'


export default async function AdminSupportPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin'

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Fetch all support tickets with user information
  // Kullanıcı e-postaları istemci rollerine kapalı; admin ekranı service role ile okur.
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) {
    throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
  }

  const { data: tickets, error } = await supabaseAdmin
    .from('support_tickets')
    .select(`
      id,
      user_id,
      subject,
      priority,
      message,
      file_url,
      status,
      admin_response,
      created_at,
      updated_at,
      users:user_id (
        id,
        full_name,
        email,
        username,
        avatar_url,
        role
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[AdminSupportPage] error:', error)
  }

  return <SupportTicketsPanel initialTickets={(tickets ?? []) as any} />
}

