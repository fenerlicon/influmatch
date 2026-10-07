export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import ApiKeysPanel from '@/components/admin/ApiKeysPanel'
import { loadApiKeyDashboard } from './data'

export default async function AdminApiKeysPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // API anahtarları tablosu sadece service role ile okunabilir.
  const supabaseAdmin = createSupabaseAdminClient()
  if (!supabaseAdmin) {
    throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
  }

  return <ApiKeysPanel initialDashboard={await loadApiKeyDashboard(supabaseAdmin)} />
}
