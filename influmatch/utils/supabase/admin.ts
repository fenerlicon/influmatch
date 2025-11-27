// Admin/Security Definer client for server-side operations that need to bypass RLS
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// This client uses service role key and bypasses RLS
// Returns null if service role key is not available (falls back to SQL function)
export const createSupabaseAdminClient = (): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[createSupabaseAdminClient] Service role key not found, will use SQL function instead')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

