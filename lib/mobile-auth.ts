import { createClient, type User } from '@supabase/supabase-js'

/**
 * Mobil istemciler cookie yerine "Authorization: Bearer <access_token>" gönderir.
 * Token'ı Supabase'e doğrulatır ve oturum sahibini döner; geçersizse null.
 */
export async function getBearerUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
