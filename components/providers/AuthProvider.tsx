'use client'

import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'

// useSupabaseClient / useSession kancaları bu bağlam üzerinden aynı @supabase/ssr istemcisini kullanır.
export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [supabase] = useState(() => createSupabaseBrowserClient())

    return (
        <SessionContextProvider supabaseClient={supabase}>
            {children}
        </SessionContextProvider>
    )
}
