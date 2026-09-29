import { redirect } from 'next/navigation'
import FeedbackAdminPanel from '@/components/admin/FeedbackAdminPanel'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'


export const revalidate = 0

export default async function AdminFeedbackPage() {
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

  // Fetch feedback submissions with user details
  // Kullanıcı e-postaları istemci rollerine kapalı; admin ekranı service role ile okur.
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) {
    throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
  }

  const { data: feedbackSubmissions } = await supabaseAdmin
    .from('feedback_submissions')
    .select(
      `
      id,
      description,
      image_url,
      status,
      admin_notes,
      created_at,
      role,
      user:user_id (
        id,
        full_name,
        email,
        username
      )
    `
    )
    .order('created_at', { ascending: false })

  return (
    <FeedbackAdminPanel
      feedbackSubmissions={
        feedbackSubmissions?.map((submission) => ({
          id: submission.id,
          description: submission.description,
          imageUrl: submission.image_url,
          status: submission.status as 'pending' | 'reviewed' | 'resolved' | 'archived',
          adminNotes: submission.admin_notes,
          createdAt: submission.created_at,
          role: submission.role as 'influencer' | 'brand',
          user: (() => {
            const u = submission.user as any
            return (Array.isArray(u) ? u[0] : u) as {
              id: string
              full_name: string | null
              email: string | null
              username: string | null
            }
          })(),
        })) ?? []
      }
    />
  )
}

