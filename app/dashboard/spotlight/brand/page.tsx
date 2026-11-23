import SpotlightPlansPage from '@/components/spotlight/SpotlightPlansPage'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getPurchaseState } from '@/lib/payments/purchase-state'

export const revalidate = 0
export const metadata = { title: 'Spotlight | Influmatch' }

export default async function Page() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Satın alma durumu sunucuda (satış bayrağı, doğrulama, canlı abonelik); oturum yoksa ara katman zaten girişe yönlendirir.
  const purchase = user ? await getPurchaseState(user.id) : null
  return <SpotlightPlansPage role="brand" purchase={purchase} />
}
