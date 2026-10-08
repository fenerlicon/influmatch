import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

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

/**
 * Mobil uç için kullanıcı ve o kullanıcının yetkileriyle çalışan Supabase istemcisi.
 * İstemci kullanıcının JWT'sini taşır; RLS ve kolon yetkileri web oturumundakiyle aynen uygulanır.
 */
export async function getBearerContext(request: Request): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { user: data.user, supabase }
}

/** Mobil uçlar için ortak JSON yanıtı. */
export function mobileJson(body: unknown, status = 200) {
  return Response.json(body, { status })
}
