// "Zamanında Ödeme" (marka) ve "Zamanında Teslim" (influencer) rozetleri (2026-11-23; SYSTEM_MAP 15).
// Eşikler tek yerde: lib/collaboration-trust-shared.ts TRUST_BADGE_RULES. Saatlik görevde hesaplanır; kuralı artık
// sağlamayanın rozeti geri alınır (lib/badge-sync.ts). Tablolar yoksa (güvenli iş birliği SQL'i çalıştırılmadı) atlanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncBadgeHolders, type BadgeSyncSummary } from '@/lib/badge-sync'
import { trustReady } from '@/lib/collaboration-trust'
import {
  TRUST_BADGE_RULES,
  isDeliveryOnTime,
  isPaymentOnTime,
  onTimeDeliveryEligible,
  onTimePaymentEligible,
  type DeliveryBadgeStats,
  type PaymentBadgeStats,
} from '@/lib/collaboration-trust-shared'

const PAGE = 1000
const DAY_MS = 24 * 60 * 60 * 1000

async function fetchAll<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

async function inChunks<T>(ids: string[], load: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await load(ids.slice(i, i + 200))
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
  }
  return rows
}

async function upheldBy(admin: SupabaseClient, kind: 'nonpayment' | 'nondelivery', windowDays: number) {
  const since = new Date(Date.now() - windowDays * DAY_MS).toISOString()
  const rows = await fetchAll<{ respondent_id: string }>((from, to) =>
    admin.from('collaboration_disputes').select('respondent_id').eq('kind', kind).eq('status', 'upheld').gte('decided_at', since).range(from, to),
  )
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.respondent_id, (counts.get(r.respondent_id) ?? 0) + 1)
  return counts
}

export async function paymentBadgeStats(admin: SupabaseClient): Promise<Map<string, PaymentBadgeStats>> {
  const confirmed = await fetchAll<{ collaboration_id: string; brand_paid_date: string | null }>((from, to) =>
    admin
      .from('collaboration_payments')
      .select('collaboration_id, brand_paid_date')
      .not('brand_paid_at', 'is', null)
      .not('influencer_received_at', 'is', null)
      .range(from, to),
  )
  const ids = confirmed.map((p) => p.collaboration_id)
  const [collabs, agreements, upheld] = await Promise.all([
    inChunks<{ id: string; brand_id: string; status: string }>(ids, (chunk) => admin.from('collaborations').select('id, brand_id, status').in('id', chunk)),
    inChunks<{ collaboration_id: string; payment_due_date: string | null }>(ids, (chunk) =>
      admin.from('collaboration_agreements').select('collaboration_id, payment_due_date').in('collaboration_id', chunk),
    ),
    upheldBy(admin, 'nonpayment', TRUST_BADGE_RULES.onTimePayment.disputeWindowDays),
  ])
  const brandOf = new Map(collabs.filter((c) => c.status !== 'cancelled').map((c) => [c.id, c.brand_id]))
  const dueOf = new Map(agreements.map((a) => [a.collaboration_id, a.payment_due_date]))
  const stats = new Map<string, PaymentBadgeStats>()
  for (const p of confirmed) {
    const brandId = brandOf.get(p.collaboration_id)
    if (!brandId) continue
    const s = stats.get(brandId) ?? { confirmed: 0, onTime: 0, withDueDate: 0, upheldDisputes: upheld.get(brandId) ?? 0 }
    s.confirmed++
    const onTime = isPaymentOnTime(p.brand_paid_date, dueOf.get(p.collaboration_id))
    if (onTime !== null) {
      s.withDueDate++
      if (onTime) s.onTime++
    }
    stats.set(brandId, s)
  }
  return stats
}

export async function deliveryBadgeStats(admin: SupabaseClient): Promise<Map<string, DeliveryBadgeStats>> {
  const completed = await fetchAll<{ id: string; influencer_id: string }>((from, to) =>
    admin.from('collaborations').select('id, influencer_id').eq('status', 'completed').range(from, to),
  )
  const [deliverables, upheld] = await Promise.all([
    inChunks<{ collaboration_id: string; due_date: string | null; approved_at: string | null; published_at: string | null }>(
      completed.map((c) => c.id),
      (chunk) => admin.from('collaboration_deliverables').select('collaboration_id, due_date, approved_at, published_at').in('collaboration_id', chunk),
    ),
    upheldBy(admin, 'nondelivery', TRUST_BADGE_RULES.onTimeDelivery.disputeWindowDays),
  ])
  const influencerOf = new Map(completed.map((c) => [c.id, c.influencer_id]))
  const stats = new Map<string, DeliveryBadgeStats>()
  for (const c of completed) {
    const s = stats.get(c.influencer_id) ?? { completed: 0, onTime: 0, withDueDate: 0, upheldDisputes: upheld.get(c.influencer_id) ?? 0 }
    s.completed++
    stats.set(c.influencer_id, s)
  }
  for (const d of deliverables) {
    const influencerId = influencerOf.get(d.collaboration_id)
    const s = influencerId ? stats.get(influencerId) : null
    if (!s) continue
    const onTime = isDeliveryOnTime(d)
    if (onTime === null) continue
    s.withDueDate++
    if (onTime) s.onTime++
  }
  return stats
}

/** Saatlik görev: iki rozeti kurala göre verir / geri alır. Bir kuralın verisi okunamazsa o rozete dokunulmaz. */
export async function sweepTrustBadges(admin: SupabaseClient) {
  const result: Record<string, BadgeSyncSummary | { error: string } | { skipped: string }> = {}
  if (!(await trustReady(admin))) return { skipped: 'tables_missing' }
  try {
    const stats = await paymentBadgeStats(admin)
    const eligible = new Set(Array.from(stats.entries()).filter(([, s]) => onTimePaymentEligible(s)).map(([id]) => id))
    result[TRUST_BADGE_RULES.onTimePayment.badgeId] = await syncBadgeHolders(admin, TRUST_BADGE_RULES.onTimePayment.badgeId, eligible, 'brand')
  } catch (error) {
    console.error('[trust-badges] Zamanında Ödeme değerlendirilemedi:', error)
    result[TRUST_BADGE_RULES.onTimePayment.badgeId] = { error: error instanceof Error ? error.message : String(error) }
  }
  try {
    const stats = await deliveryBadgeStats(admin)
    const eligible = new Set(Array.from(stats.entries()).filter(([, s]) => onTimeDeliveryEligible(s)).map(([id]) => id))
    result[TRUST_BADGE_RULES.onTimeDelivery.badgeId] = await syncBadgeHolders(admin, TRUST_BADGE_RULES.onTimeDelivery.badgeId, eligible, 'influencer')
  } catch (error) {
    console.error('[trust-badges] Zamanında Teslim değerlendirilemedi:', error)
    result[TRUST_BADGE_RULES.onTimeDelivery.badgeId] = { error: error instanceof Error ? error.message : String(error) }
  }
  return result
}
