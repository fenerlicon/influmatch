export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import BillingAdminPanel, { type AdminBillingData } from '@/components/admin/billing/BillingAdminPanel'
import { iyzicoModeInfo } from '@/lib/payments/iyzico'
import { storeVerificationConfigured } from '@/lib/payments/store-flow'
import { PAYMENT_COLUMNS, SUBSCRIPTION_COLUMNS, billingTablesReady, loadBillingSettings, type PaymentRow, type SubscriptionRow } from '@/lib/payments/subscriptions'
import { loadPromoPeriod } from '@/lib/tasks-promo'

const SOURCES = ['iyzico', 'apple', 'google', 'admin', 'promo', 'reward']
const STATUSES = ['pending', 'active', 'past_due', 'canceled', 'expired']

/** Admin: abonelikler, ödemeler, başarısız tahsilatlar, iade, satış bayrakları ve 0₺ dönemi. Anahtar gösterilmez. */
export default async function AdminBillingPage({ searchParams }: { searchParams: { kaynak?: string; durum?: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')

  const ready = await billingTablesReady(admin)
  const [settings, promoPeriod] = await Promise.all([loadBillingSettings(admin), loadPromoPeriod(admin)])
  const source = SOURCES.includes(searchParams.kaynak ?? '') ? searchParams.kaynak! : null
  const status = STATUSES.includes(searchParams.durum ?? '') ? searchParams.durum! : null

  let subscriptions: SubscriptionRow[] = []
  let payments: PaymentRow[] = []
  let failed: PaymentRow[] = []
  let events: AdminBillingData['events'] = []
  let counts: Record<string, number> = {}
  if (ready) {
    let q = admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).order('created_at', { ascending: false }).limit(200)
    if (source) q = q.eq('source', source)
    if (status) q = q.eq('status', status)
    const [subs, pays, fails, evs, live] = await Promise.all([
      q,
      admin.from('payments').select(PAYMENT_COLUMNS).order('created_at', { ascending: false }).limit(100),
      admin.from('payments').select(PAYMENT_COLUMNS).eq('status', 'failed').order('created_at', { ascending: false }).limit(50),
      admin.from('payment_events').select('id, provider, event_type, signature_valid, received_at, processed_at, result').order('received_at', { ascending: false }).limit(30),
      admin.from('subscriptions').select('source, status').in('status', ['active', 'past_due']).limit(20000),
    ])
    subscriptions = (subs.data ?? []) as SubscriptionRow[]
    payments = (pays.data ?? []) as PaymentRow[]
    failed = (fails.data ?? []) as PaymentRow[]
    events = (evs.data ?? []) as AdminBillingData['events']
    counts = {}
    for (const r of live.data ?? []) counts[`${r.source}:${r.status}`] = (counts[`${r.source}:${r.status}`] ?? 0) + 1
  }

  const userIds = Array.from(new Set([...subscriptions, ...payments, ...failed].map((r) => r.user_id)))
  const names: Record<string, string> = {}
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await admin.from('users').select('id, username, full_name').in('id', userIds.slice(i, i + 200))
    for (const u of data ?? []) names[u.id as string] = (u.username ? `@${u.username}` : (u.full_name as string)) || (u.id as string).slice(0, 8)
  }

  const data: AdminBillingData = {
    ready,
    settings,
    promoPeriod,
    iyzico: iyzicoModeInfo(),
    store: storeVerificationConfigured(),
    filters: { source, status },
    counts,
    subscriptions,
    payments,
    failed,
    events,
    names,
  }
  return <BillingAdminPanel data={data} />
}
