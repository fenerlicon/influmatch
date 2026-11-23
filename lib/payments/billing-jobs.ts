// Saatlik görev: abonelik eşitlemesi ve hatırlatmalar (2026-11-23). Her adım küçük partilerle ve süre bütçesiyle çalışır;
// tablolar yoksa hiçbir şey yapmaz.
//  1. Süresi geçen ödeme formları: iyzico'ya sorulur, tamamlanmışsa abonelik açılır, değilse düşer (kod serbest kalır).
//  2. Kaçan webhook: dönem sonu yaklaşan / geçen ya da ödemesi alınamamış iyzico abonelikleri API'den yeniden okunur.
//  3. Ödemesi alınamayan ve ek süresi biten abonelik iyzico'da iptal edilir, sona erer; kullanıcıya bildirim.
//  4. Dönemi biten iptal edilmiş / süreli (admin, 0₺, ödül) kayıtlar kapanır.
//  5. Mağaza abonelikleri (dönem sonu geçmiş) mağazadan yeniden okunur.
//  6. Yıllık yenileme hatırlatması (7 gün önce) ve süreli üyelik bitiş bildirimi (7 gün önce; 0₺ kampanyası sonu dahil).
//  7. 0₺ dönemi: kampanya açık ve bitiş tarihi girilmişse doğrulanmış her influencer / marka hesabına bitiş tarihine kadar Spotlight Pro.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR.

import type { SupabaseClient } from '@supabase/supabase-js'
import { DAY_MS, PLAN_LABELS, expiryNoticeDue, isPaidSource, proPlanForRole, renewalReminderDue, type BillingRole } from '@/lib/payments/billing-shared'
import { cancelSubscription } from '@/lib/payments/iyzico'
import { expireStalePendingCheckouts, reconcileIyzicoSubscription } from '@/lib/payments/iyzico-flow'
import { refreshStoreSubscription } from '@/lib/payments/store-flow'
import {
  SUBSCRIPTION_COLUMNS,
  billingTablesReady,
  loadBillingSettings,
  notifyBilling,
  syncUserSpotlightSafe,
  updateSubscription,
  type SubscriptionRow,
} from '@/lib/payments/subscriptions'
import { loadPromoPeriod } from '@/lib/tasks-promo'

function trDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })
}

export async function runBillingJobs(admin: SupabaseClient, options: { deadline: number; now?: Date }) {
  if (!(await billingTablesReady(admin))) return { skipped: 'tablolar yok' }
  const now = options.now ?? new Date()
  const timeLeft = () => Date.now() < options.deadline
  const out: Record<string, unknown> = {}

  out.pending = await expireStalePendingCheckouts(admin, { limit: 10, deadline: options.deadline }, now)

  // 2) iyzico: dönem sonu 1 saat içinde ya da geçmiş, ya da ödemesi alınamamış; son 3 saatte bakılmamış (en fazla 10).
  if (timeLeft()) {
    const soon = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    const stale = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('source', 'iyzico')
      .in('status', ['active', 'past_due'])
      .not('iyzico_subscription_ref', 'is', null)
      .or(`current_period_end.lt.${soon},status.eq.past_due`)
      .order('last_synced_at', { ascending: true, nullsFirst: true })
      .limit(30)
    const due = ((data ?? []) as SubscriptionRow[]).filter((r) => !r.last_synced_at || new Date(r.last_synced_at).getTime() < new Date(stale).getTime()).slice(0, 10)
    let synced = 0
    for (const row of due) {
      if (!timeLeft()) break
      const res = await reconcileIyzicoSubscription(admin, row)
      if (res.ok) synced++
    }
    out.iyzicoSynced = synced
  }

  // 3) Ek süresi biten past_due → iptal + sona erdi.
  if (timeLeft()) {
    const { data } = await admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('status', 'past_due').lt('grace_until', now.toISOString()).limit(20)
    let ended = 0
    for (const row of (data ?? []) as SubscriptionRow[]) {
      if (!timeLeft()) break
      if (row.source === 'iyzico' && row.iyzico_subscription_ref) {
        const res = await cancelSubscription(row.iyzico_subscription_ref)
        if (!res.ok) console.error('[billing] ek süre sonu iptali başarısız:', res.errorMessage)
      }
      // Mağaza aboneliğini mağaza yönetir; burada yalnızca hak kapanır (mağaza yeniden denerse bildirimle geri açılır).
      await updateSubscription(admin, row.id, { status: 'expired', canceled_at: row.canceled_at ?? now.toISOString() })
      await syncUserSpotlightSafe(admin, row.user_id)
      await notifyBilling(admin, row.user_id, 'Spotlight üyeliğin sona erdi', 'Yenileme ödemesi alınamadığı için Spotlight üyeliğin sona erdi. İstediğin zaman yeniden abone olabilirsin.', 'warning')
      ended++
    }
    out.pastDueEnded = ended
  }

  // 4) Dönemi biten iptal edilmiş ücretli kayıtlar ve süreli ücretsiz kayıtlar kapanır.
  if (timeLeft()) {
    const { data } = await admin
      .from('subscriptions')
      .select('id, user_id, source, cancel_at_period_end')
      .eq('status', 'active')
      .lt('current_period_end', now.toISOString())
      .limit(200)
    const closable = (data ?? []).filter((r) => !isPaidSource(r.source as string) || r.cancel_at_period_end)
    const users = new Set<string>()
    for (const r of closable) {
      const status = isPaidSource(r.source as string) ? 'canceled' : 'expired'
      await admin.from('subscriptions').update({ status, updated_at: now.toISOString() }).eq('id', r.id).eq('status', 'active')
      users.add(r.user_id as string)
    }
    for (const userId of Array.from(users)) await syncUserSpotlightSafe(admin, userId)
    out.closed = closable.length
  }

  // 5) Mağaza: dönem sonu geçmiş, son 6 saatte bakılmamış (en fazla 5).
  if (timeLeft()) {
    const stale = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .in('source', ['apple', 'google'])
      .in('status', ['active', 'past_due'])
      .lt('current_period_end', now.toISOString())
      .order('last_synced_at', { ascending: true, nullsFirst: true })
      .limit(20)
    const due = ((data ?? []) as SubscriptionRow[]).filter((r) => !r.last_synced_at || new Date(r.last_synced_at).getTime() < new Date(stale).getTime()).slice(0, 5)
    let refreshed = 0
    for (const row of due) {
      if (!timeLeft()) break
      if (await refreshStoreSubscription(admin, row)) refreshed++
      else await admin.from('subscriptions').update({ last_synced_at: now.toISOString() }).eq('id', row.id)
    }
    out.storeRefreshed = refreshed
  }

  // 6) Hatırlatmalar (en fazla 100 kayıt).
  if (timeLeft()) {
    const horizon = new Date(now.getTime() + 7 * DAY_MS).toISOString()
    const { data } = await admin
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('status', 'active')
      .gt('current_period_end', now.toISOString())
      .lt('current_period_end', horizon)
      .limit(100)
    let reminders = 0
    let notices = 0
    for (const row of (data ?? []) as SubscriptionRow[]) {
      if (!timeLeft()) break
      if (renewalReminderDue(row, now)) {
        await notifyBilling(
          admin,
          row.user_id,
          'Yıllık aboneliğin yenileniyor',
          `${PLAN_LABELS[row.plan]} yıllık aboneliğin ${trDate(row.current_period_end)} tarihinde yenilenecek. İptal etmek istersen Ayarlar > Üyelik ve ödemeler.`,
        )
        await updateSubscription(admin, row.id, { renewal_reminder_for: row.current_period_end })
        reminders++
      } else if (expiryNoticeDue(row, now)) {
        const promo = row.source === 'promo'
        await notifyBilling(
          admin,
          row.user_id,
          'Spotlight üyeliğin bitiyor',
          promo
            ? `0₺ dönemindeki Spotlight üyeliğin ${trDate(row.current_period_end)} tarihinde bitiyor. Devam etmek istersen Spotlight sayfasından abone olabilirsin.`
            : `Spotlight üyeliğin ${trDate(row.current_period_end)} tarihinde bitiyor.`,
        )
        await updateSubscription(admin, row.id, { expiry_notice_for: row.current_period_end })
        notices++
      }
    }
    out.reminders = reminders
    out.expiryNotices = notices
  }

  // 7) 0₺ dönemi Pro dağıtımı.
  if (timeLeft()) out.promo = await sweepPromoGrants(admin, { limit: 200, deadline: options.deadline, now })

  return out
}

/**
 * 0₺ dönemi: kampanya anahtarı (promo_period_enabled) açık ve bitiş tarihi (promo_ends_at, gelecekte) girilmişse,
 * henüz 0₺ kaydı olmayan doğrulanmış influencer / marka hesaplarına bitiş tarihine kadar Spotlight Pro verir.
 */
export async function sweepPromoGrants(admin: SupabaseClient, options: { limit: number; deadline?: number; now?: Date }) {
  const now = options.now ?? new Date()
  const [settings, promoOn] = await Promise.all([loadBillingSettings(admin), loadPromoPeriod(admin)])
  if (!promoOn || !settings.promo_ends_at || new Date(settings.promo_ends_at).getTime() <= now.getTime()) return { granted: 0, skipped: 'kapalı' }

  const { data: existing } = await admin.from('subscriptions').select('user_id').eq('source', 'promo').limit(100000)
  const have = new Set((existing ?? []).map((r) => r.user_id as string))
  let granted = 0
  for (let from = 0; granted < options.limit; from += 1000) {
    if (options.deadline && Date.now() > options.deadline) break
    const { data: users, error } = await admin
      .from('users')
      .select('id, role')
      .in('role', ['influencer', 'brand'])
      .eq('verification_status', 'verified')
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error || !users?.length) break
    const batch = users.filter((u) => !have.has(u.id as string)).slice(0, options.limit - granted)
    if (batch.length) {
      const nowIso = now.toISOString()
      const { error: insertError } = await admin.from('subscriptions').insert(
        batch.map((u) => ({
          user_id: u.id,
          plan: proPlanForRole(u.role as BillingRole),
          source: 'promo',
          status: 'active',
          current_period_start: nowIso,
          current_period_end: settings.promo_ends_at,
          note: '0₺ dönemi',
        })),
      )
      if (insertError) {
        console.error('[billing] 0₺ dağıtımı:', insertError.message)
        break
      }
      for (const u of batch) {
        have.add(u.id as string)
        if (options.deadline && Date.now() > options.deadline) continue
        await syncUserSpotlightSafe(admin, u.id as string)
      }
      granted += batch.length
    }
    if (users.length < 1000) break
  }
  return { granted }
}

/** Admin 0₺ bitiş tarihini değiştirince: aktif 0₺ kayıtlarının bitişi güncellenir, bitiş bildirimi yeniden gönderilebilir. */
export async function updatePromoEnd(admin: SupabaseClient, endsAt: string) {
  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('subscriptions')
    .update({ current_period_end: endsAt, expiry_notice_for: null, updated_at: nowIso })
    .eq('source', 'promo')
    .eq('status', 'active')
    .select('user_id')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.user_id as string)
}
