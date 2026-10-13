import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import { SHELL_USER_COLUMNS, buildShellUser } from '@/lib/shell-user'
import { createSupabaseServerClient } from '@/utils/supabase/server'

// Başkasının profili panel kabuğunun içinde açılır (kenar çubuğu kaybolmaz, docs/REDESIGN.md).
// Profiller yalnızca oturum açmış kullanıcıya görünür (middleware + sayfa kontrolü, kural 2).
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: row } = await supabase.from('users').select(SHELL_USER_COLUMNS).eq('id', user.id).maybeSingle()

  return <AppShell user={buildShellUser(user, row)}>{children}</AppShell>
}
