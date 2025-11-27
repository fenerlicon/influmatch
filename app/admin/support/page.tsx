export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import SupportTicketsPanel from '@/components/admin/SupportTicketsPanel'

const ADMIN_EMAIL = 'admin@influmatch.net'

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
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Fetch all support tickets with user information
  const { data: tickets, error } = await supabase
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

