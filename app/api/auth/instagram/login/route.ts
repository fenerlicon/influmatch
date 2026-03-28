
import { getInstagramAuthUrl } from '@/utils/meta-service'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * Initiates the Meta/Instagram OAuth login flow
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  // Generate a random state for CSRF protection
  const state = uuidv4()
  
  // In a real production app, we should store this state in a session cookie or DB
  // to verify it in the callback
  const authUrl = getInstagramAuthUrl(state)

  return NextResponse.redirect(new URL(authUrl))
}
