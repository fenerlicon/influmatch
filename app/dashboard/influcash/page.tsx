import { notFound, redirect } from 'next/navigation'
import InflucashView from '@/components/influcash/InflucashView'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { fetchAccountRole } from '@/lib/viewer-role'
import { getInflucashOverview } from '@/lib/influcash'

export const revalidate = 0

// Influcash (2026-11-23). Bayrak kapalıysa ya da tablolar canlıda yoksa sayfa yok (404).
export default async function InflucashPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = await fetchAccountRole(supabase, user.id)
  if (role !== 'influencer' && role !== 'brand') notFound()
  const overview = await getInflucashOverview(user.id)
  if (!overview) notFound()
  return <InflucashView overview={overview} role={role} />
}
