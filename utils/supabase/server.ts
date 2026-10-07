import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Tek sunucu istemcisi (@supabase/ssr). Route handler ve server action içinde çerez yazabilir;
// server component içinde Next.js çerez yazmaya izin vermez, o durumda oturum yenilemesini
// middleware yapar ve buradaki yazma denemesi sessizce atlanır.
export const createSupabaseServerClient = () => {
  const cookieStore = cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server component: çerez yazılamaz (middleware yeniler).
        }
      },
    },
  })
}
