'use client'

import { SessionContextProvider } from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/supabase-js'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'

interface SupabaseProviderProps {
  initialSession?: Session | null
  children: React.ReactNode
}

export default function SupabaseProvider({ children, initialSession }: SupabaseProviderProps) {
  const [supabaseClient] = useState(() => createSupabaseBrowserClient())

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={initialSession}>
      {children}
    </SessionContextProvider>
  )
}

