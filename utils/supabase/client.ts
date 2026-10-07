'use client'

import { createBrowserClient } from '@supabase/ssr'

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

// @supabase/ssr tarayıcıda tek bir istemci örneği döndürür (her çağrıda yenisi açılmaz);
// AuthProvider ve doğrudan bu fonksiyonu çağıran bileşenler aynı oturumu paylaşır.
export const createSupabaseBrowserClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
