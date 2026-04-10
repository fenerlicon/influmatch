'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Fetches applications for specific projects using service role to bypass RLS.
 * This is used as a workaround for complex RLS issues preventing brands from seeing applications.
 */
export async function getBrandApplicationsAdmin(projectIds: string[]) {
  if (!projectIds || projectIds.length === 0) return { applications: [] }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data, error } = await supabaseAdmin
    .from('advert_applications')
    .select(`
      id, 
      advert_id, 
      influencer_id, 
      cover_letter, 
      deliverable_idea, 
      budget_expectation, 
      status, 
      created_at,
      influencer:users!influencer_user_id (
        id,
        full_name,
        username,
        avatar_url,
        verification_status
      ),
      advert:advert_id (
        title,
        category
      )
    `)
    .in('advert_id', projectIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getBrandApplicationsAdmin] Error:', error)
    return { error: error.message, applications: [] }
  }

  return { applications: data || [] }
}
