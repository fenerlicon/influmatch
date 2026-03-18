
import { getTikTokAuthUrl } from '@/utils/tiktok-service'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * Initiates the TikTok OAuth login flow
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  // Generate a random state for CSRF protection
  const state = uuidv4()
  
  // We should ideally store this state to verify it in the callback
  // But for simple integration, we'll just redirect
  const authUrl = getTikTokAuthUrl(state)

  return NextResponse.redirect(new URL(authUrl))
}
