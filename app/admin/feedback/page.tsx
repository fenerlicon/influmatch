import { redirect } from 'next/navigation'
import FeedbackAdminPanel from '@/components/admin/FeedbackAdminPanel'
import { createSupabaseServerClient } from '@/utils/supabase/server'

const ADMIN_EMAIL = 'admin@influmatch.net'

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
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = adminProfile?.role === 'admin' || user.email === ADMIN_EMAIL

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Fetch feedback submissions with user details
  const { data: feedbackSubmissions } = await supabase
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
          user: (Array.isArray(submission.user) ? submission.user[0] : submission.user) as {
            id: string
            full_name: string | null
            email: string | null
            username: string | null
          },
        })) ?? []
      }
    />
  )
}

