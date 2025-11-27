'use client'

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

const getSupabaseEnv = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

export const createSupabaseBrowserClient = (): SupabaseClient => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  return createPagesBrowserClient({
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  })
}

