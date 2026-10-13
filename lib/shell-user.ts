import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { isProPlan } from '@/lib/subscription-tier'
import type { ShellUser } from '@/components/shell/AppShell'
import type { ShellRole } from '@/components/shell/nav-config'

/** Kabuğun ihtiyaç duyduğu users kolonları (dashboard ve profil layout'ları bu kolonları seçer). */
export const SHELL_USER_COLUMNS = 'role, full_name, username, avatar_url, spotlight_active, spotlight_plan, spotlight_expires_at'

interface ShellRow {
  role?: string | null
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
  spotlight_active?: boolean | null
  spotlight_plan?: string | null
  spotlight_expires_at?: string | null
}

export function buildShellUser(
  authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
  row: ShellRow | null | undefined,
): ShellUser {
  const role: ShellRole = row?.role === 'brand' || row?.role === 'admin' ? row.role : 'influencer'
  const metaName = typeof authUser.user_metadata?.full_name === 'string' ? (authUser.user_metadata.full_name as string) : null
  const active = hasActiveSpotlight(row)
  const expires = active && row?.spotlight_expires_at ? new Date(row.spotlight_expires_at) : null
  return {
    id: authUser.id,
    role,
    name: row?.full_name || metaName || authUser.email || 'Kullanıcı',
    subtitle: row?.username ? `@${row.username}` : authUser.email ?? null,
    avatarUrl: row?.avatar_url ?? null,
    spotlight: {
      active,
      planLabel: active && row?.spotlight_plan ? (isProPlan(row.spotlight_plan) ? 'Pro' : 'Basic') : null,
      expiresText: expires ? expires.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : null,
    },
  }
}
