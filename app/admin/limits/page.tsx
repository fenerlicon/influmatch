export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { loadPlatformSettings } from '@/lib/platform-settings'
import PlatformSettingsPanel from '@/components/admin/PlatformSettingsPanel'

export default async function AdminLimitsPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') redirect('/dashboard')

  // platform_settings istemci rollerine kapalı; yalnızca service role okur.
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')

  return <PlatformSettingsPanel initialSettings={await loadPlatformSettings(supabaseAdmin)} />
}
