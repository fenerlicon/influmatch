import { Card, CardBody, CardHeader, Notice } from '@/components/ui'
import BillingSection, { type BillingSectionData } from '@/components/settings/BillingSection'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getBillingOverview, listUsableCodes, listUserPayments } from '@/lib/payments/subscriptions'
import { plansForRole } from '@/lib/payments/billing-shared'

/** Ayarlar > Üyelik ve ödemeler (sunucu): veriler service role ile, yalnızca oturumdaki kullanıcınınki okunur. */
export default async function BillingSettings({ userId, cardUpdated }: { userId: string; cardUpdated?: boolean }) {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const overview = await getBillingOverview(admin, userId)
  if (!overview.tablesReady) {
    return (
      <Card>
        <CardHeader title="Üyelik ve ödemeler" />
        <CardBody>
          <Notice tone="info">Üyelik bilgileri yakında burada görünecek.</Notice>
        </CardBody>
      </Card>
    )
  }
  const [payments, codes] = await Promise.all([listUserPayments(admin, userId), listUsableCodes(admin, userId)])
  const paid = overview.livePaid
  const data: BillingSectionData = {
    role: overview.role,
    paymentsEnabled: overview.settings.payments_enabled,
    entitlement: overview.entitlement ? { plan: overview.entitlement.plan, expiresAt: overview.entitlement.expiresAt, source: overview.entitlement.source } : null,
    subscription: paid
      ? {
          id: paid.id,
          plan: paid.plan,
          interval: paid.billing_interval ?? 'mo',
          source: paid.source,
          status: paid.status,
          periodEnd: paid.current_period_end,
          graceUntil: paid.grace_until,
          cancelAtPeriodEnd: paid.cancel_at_period_end,
          pendingPlan: paid.pending_plan,
          discountState: paid.discount_state,
          discountPercent: paid.discount_percent,
          discountKind: paid.discount_kind,
        }
      : null,
    otherPlan: paid && overview.role ? plansForRole(overview.role).find((p) => p !== paid.plan) ?? null : null,
    payments: payments.map((p) => ({
      id: p.id,
      date: p.created_at,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      plan: p.plan,
      interval: p.billing_interval,
      provider: p.provider,
      discountPercent: p.discount_percent,
    })),
    codes: codes.map((c) => ({ code: c.code, percent: c.percent })),
    cardUpdated: !!cardUpdated,
  }
  return <BillingSection data={data} />
}
