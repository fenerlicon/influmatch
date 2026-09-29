
import { getInstagramAuthUrl } from '@/utils/meta-service'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { createOAuthState } from '@/lib/oauth-state'

/**
 * Initiates the Meta/Instagram OAuth login flow
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  const state = createOAuthState('instagram')
  const authUrl = getInstagramAuthUrl(state)

  return NextResponse.redirect(new URL(authUrl))
}
