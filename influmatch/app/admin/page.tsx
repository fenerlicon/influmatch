import { redirect } from 'next/navigation'
import AdminPanel from '@/components/admin/AdminPanel'
import { createSupabaseServerClient } from '@/utils/supabase/server'

const ADMIN_EMAIL = 'admin@influmatch.net'

export default async function AdminPage() {
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

  // Fetch users by verification status with all required fields
  const { data: pendingUsers } = await supabase
    .from('users')
    .select('id, full_name, email, role, avatar_url, username, social_links, verification_status, admin_notes, created_at, bio, category, city')
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: false })

  const { data: verifiedUsers } = await supabase
    .from('users')
    .select('id, full_name, email, role, avatar_url, username, social_links, verification_status, admin_notes, created_at, bio, category, city')
    .eq('verification_status', 'verified')
    .order('created_at', { ascending: false })

  const { data: rejectedUsers } = await supabase
    .from('users')
    .select('id, full_name, email, role, avatar_url, username, social_links, verification_status, admin_notes, created_at, bio, category, city')
    .eq('verification_status', 'rejected')
    .order('created_at', { ascending: false })

  return (
    <AdminPanel
      pendingUsers={pendingUsers ?? []}
      verifiedUsers={verifiedUsers ?? []}
      rejectedUsers={rejectedUsers ?? []}
    />
  )
}

