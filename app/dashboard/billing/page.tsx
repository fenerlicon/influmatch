import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'

/** Bildirim ve e-posta bağlantısı: rolün Ayarlar > Üyelik ve ödemeler bölümüne yönlenir. */
export default async function BillingRedirect({ searchParams }: { searchParams: { kart?: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const base = data?.role === 'brand' ? '/dashboard/brand/settings' : data?.role === 'admin' ? '/admin/billing' : '/dashboard/influencer/settings'
  redirect(data?.role === 'admin' ? base : `${base}?bolum=uyelik${searchParams.kart ? `&kart=${encodeURIComponent(searchParams.kart)}` : ''}`)
}
