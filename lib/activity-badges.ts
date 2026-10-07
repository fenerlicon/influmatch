// Etkinliğe bağlı rozetler (kullanıcı kararı, 2026-10-08). Saatlik görevde toplu değerlendirilir;
// kuralı artık sağlamayanın rozeti geri alınır (lib/badge-sync.ts).
//
// - Hızlı Dönüş (influencer): son 90 günde karşı tarafa en az 5 yanıt, ortalama yanıt süresi 2 saatin altında.
// - Marka Elçisi (influencer): aynı markayla en az 3 kabul edilmiş iş (kabul edilen teklif veya ilan başvurusu).
// - Jet Onay (marka): en az 3 başvuruya yanıt (ön liste / kabul / red), ortalama yanıt süresi 24 saat veya altı.
//   Yanıt anı advert_applications.responded_at'tan gelir (20261009000001); öncesindeki başvurular sayılmaz.
// - Elit Bütçe (marka): 50.000 TL ve üzeri bütçeli bir ilan veya teklif.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncBadgeHolders, type BadgeSyncSummary } from '@/lib/badge-sync'

export const ACTIVITY_BADGE_RULES = {
  lightningFast: { badgeId: 'lightning-fast', windowDays: 90, minReplies: 5, maxAvgMinutes: 120 },
  brandAmbassador: { badgeId: 'brand-ambassador', minJobsWithSameBrand: 3 },
  jetApproval: { badgeId: 'jet-approval', minResponses: 3, maxAvgHours: 24 },
  eliteBudget: { badgeId: 'elite-budget', minBudgetTry: 50_000 },
} as const

const PAGE = 1000

async function fetchAll<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

async function lightningFastEligible(admin: SupabaseClient) {
  const rule = ACTIVITY_BADGE_RULES.lightningFast
  const since = new Date(Date.now() - rule.windowDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin.rpc('message_reply_stats', { p_since: since })
  if (error) throw new Error(`Yanıt istatistikleri okunamadı: ${error.message}`)
  const eligible = new Set<string>()
  for (const row of (data ?? []) as { user_id: string; replies: number; avg_minutes: number }[]) {
    if (Number(row.replies) >= rule.minReplies && Number(row.avg_minutes) < rule.maxAvgMinutes) eligible.add(row.user_id)
  }
  return eligible
}

async function brandAmbassadorEligible(admin: SupabaseClient) {
  const [offers, applications] = await Promise.all([
    fetchAll<{ sender_user_id: string; receiver_user_id: string }>((from, to) =>
      admin.from('offers').select('sender_user_id, receiver_user_id').eq('status', 'accepted').range(from, to),
    ),
    fetchAll<{ influencer_id: string | null; influencer_user_id: string | null; advert: { brand_user_id: string } | { brand_user_id: string }[] | null }>(
      (from, to) =>
        admin
          .from('advert_applications')
          .select('influencer_id, influencer_user_id, advert:advert_id(brand_user_id)')
          .eq('status', 'accepted')
          .range(from, to),
    ),
  ])

  const pairs = new Map<string, number>()
  const add = (influencerId: string | null | undefined, brandId: string | null | undefined) => {
    if (!influencerId || !brandId) return
    const key = `${influencerId}:${brandId}`
    pairs.set(key, (pairs.get(key) ?? 0) + 1)
  }
  offers.forEach((offer) => add(offer.receiver_user_id, offer.sender_user_id))
  applications.forEach((app) => {
    const advert = Array.isArray(app.advert) ? app.advert[0] : app.advert
    add(app.influencer_user_id ?? app.influencer_id, advert?.brand_user_id)
  })

  const eligible = new Set<string>()
  pairs.forEach((count, key) => {
    if (count >= ACTIVITY_BADGE_RULES.brandAmbassador.minJobsWithSameBrand) eligible.add(key.split(':')[0])
  })
  return eligible
}

async function jetApprovalEligible(admin: SupabaseClient) {
  const rule = ACTIVITY_BADGE_RULES.jetApproval
  const rows = await fetchAll<{ created_at: string; responded_at: string; advert: { brand_user_id: string } | { brand_user_id: string }[] | null }>(
    (from, to) =>
      admin
        .from('advert_applications')
        .select('created_at, responded_at, advert:advert_id(brand_user_id)')
        .not('responded_at', 'is', null)
        .range(from, to),
  )

  const byBrand = new Map<string, { count: number; totalHours: number }>()
  rows.forEach((row) => {
    const advert = Array.isArray(row.advert) ? row.advert[0] : row.advert
    if (!advert?.brand_user_id) return
    const hours = Math.max(0, (new Date(row.responded_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000)
    const entry = byBrand.get(advert.brand_user_id) ?? { count: 0, totalHours: 0 }
    entry.count++
    entry.totalHours += hours
    byBrand.set(advert.brand_user_id, entry)
  })

  const eligible = new Set<string>()
  byBrand.forEach((entry, brandId) => {
    if (entry.count >= rule.minResponses && entry.totalHours / entry.count <= rule.maxAvgHours) eligible.add(brandId)
  })
  return eligible
}

async function eliteBudgetEligible(admin: SupabaseClient) {
  const min = ACTIVITY_BADGE_RULES.eliteBudget.minBudgetTry
  const [adverts, offers] = await Promise.all([
    fetchAll<{ brand_user_id: string | null; budget: number | null; budget_max: number | null; budget_currency: string | null; status: string | null }>(
      (from, to) =>
        admin
          .from('advert_projects')
          .select('brand_user_id, budget, budget_max, budget_currency, status')
          .or(`budget.gte.${min},budget_max.gte.${min}`)
          .range(from, to),
    ),
    fetchAll<{ sender_user_id: string }>((from, to) =>
      admin.from('offers').select('sender_user_id').gte('budget', min).range(from, to),
    ),
  ])

  const eligible = new Set<string>()
  adverts.forEach((advert) => {
    const currency = (advert.budget_currency || 'TRY').toUpperCase()
    if (advert.brand_user_id && currency === 'TRY' && advert.status !== 'draft') eligible.add(advert.brand_user_id)
  })
  offers.forEach((offer) => eligible.add(offer.sender_user_id))
  return eligible
}

export async function sweepActivityBadges(admin: SupabaseClient) {
  const result: Record<string, BadgeSyncSummary | { error: string }> = {}
  const rules: [string, () => Promise<Set<string>>, 'influencer' | 'brand'][] = [
    [ACTIVITY_BADGE_RULES.lightningFast.badgeId, () => lightningFastEligible(admin), 'influencer'],
    [ACTIVITY_BADGE_RULES.brandAmbassador.badgeId, () => brandAmbassadorEligible(admin), 'influencer'],
    [ACTIVITY_BADGE_RULES.jetApproval.badgeId, () => jetApprovalEligible(admin), 'brand'],
    [ACTIVITY_BADGE_RULES.eliteBudget.badgeId, () => eliteBudgetEligible(admin), 'brand'],
  ]

  // Bir kuralın verisi okunamazsa (ör. migration çalışmadıysa) o rozete dokunulmaz; diğerleri sürer.
  for (const [badgeId, loadEligible, role] of rules) {
    try {
      result[badgeId] = await syncBadgeHolders(admin, badgeId, await loadEligible(), role)
    } catch (error) {
      console.error(`[activity-badges] ${badgeId} değerlendirilemedi:`, error)
      result[badgeId] = { error: error instanceof Error ? error.message : String(error) }
    }
  }
  return result
}
