export const revalidate = 0

import { redirect } from 'next/navigation'
import { ButtonLink, Notice, PageHeader } from '@/components/ui'
import CheckoutForm from '@/components/billing/CheckoutForm'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getBillingOverview } from '@/lib/payments/subscriptions'
import { iyzicoConfig } from '@/lib/payments/iyzico'
import { previewCheckout } from '@/lib/payments/iyzico-flow'
import { PLAN_LABELS, isInterval, isPlanCode, planMatchesRole } from '@/lib/payments/billing-shared'

export const metadata = { title: 'Ödeme | Influmatch' }

/** Spotlight aboneliği ödeme sayfası: /dashboard/billing/checkout?plan=ipro&interval=mo. Satış bayrağı kapalıyken açılmaz. */
export default async function CheckoutPage({ searchParams }: { searchParams: { plan?: string; interval?: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')

  const overview = await getBillingOverview(admin, user.id)
  const spotlightHref = overview.role === 'brand' ? '/dashboard/spotlight/brand' : '/dashboard/spotlight/influencer'
  const plan = searchParams.plan
  const interval = searchParams.interval ?? 'mo'

  const blocked = (title: string, text: string, href = spotlightHref, label = 'Spotlight paketleri') => (
    <div className="grid gap-5">
      <PageHeader title="Ödeme" />
      <Notice tone="info" title={title} action={<ButtonLink href={href} size="sm">{label}</ButtonLink>}>
        {text}
      </Notice>
    </div>
  )

  const cfg = iyzicoConfig()
  if (!overview.tablesReady || !overview.settings.payments_enabled || !cfg) return blocked('Satın alma yakında', 'Spotlight satın alma henüz açılmadı.')
  if (!isPlanCode(plan) || !isInterval(interval) || !planMatchesRole(plan, overview.role)) return blocked('Paket bulunamadı', 'Hesap türüne uygun bir paket seç.')
  if (!overview.verified) return blocked('Hesabın doğrulanmalı', 'Spotlight için hesabının doğrulanmış olması gerekiyor.')
  if (overview.livePaid) {
    return blocked('Zaten aboneliğin var', 'Paket değişikliği ve iptal Ayarlar > Üyelik ve ödemeler bölümünde.', '/dashboard/billing', 'Üyelik ve ödemeler')
  }

  const [{ quote }, { data: profile }] = await Promise.all([
    previewCheckout(admin, user.id, plan, interval),
    admin.from('users').select('full_name').eq('id', user.id).maybeSingle(),
  ])

  return (
    <div className="grid gap-5">
      <PageHeader title="Ödeme" description={`${PLAN_LABELS[plan]} · ${interval === 'yr' ? 'yıllık' : 'aylık'} abonelik`} />
      <CheckoutForm plan={plan} interval={interval} initialQuote={quote} defaultName={(profile?.full_name as string | null) ?? ''} sandbox={cfg.mode === 'sandbox'} />
    </div>
  )
}
