// Influcash (2026-11-23; SYSTEM_MAP 16). Kurallar lib/influcash-shared.ts'te.
//
// Bütün yazımlar burada, service role ile ve iki veritabanı fonksiyonuyla (supabase/manual/2026-11-23_influcash.sql):
//   influcash_apply  : tek hareket + bakiye aynı işlemde; aynı (kullanıcı, neden, referans) ikinci kez yazılmaz (çift ödül yok)
//   influcash_redeem : bakiye kilidi, saatlik sınır, ürün / kitle / stok, bakiye kontrolü, ödül kaydı ve harcama tek işlemde
// Bayrak influcash_enabled kapalıyken hiçbir kazanım yazılmaz ve arayüz gizlidir (geri alım ve admin düzeltmesi yine çalışır).
// Tablolar canlıda yoksa her şey sessizce atlanır (özellik gizli), hiçbir işlem çökmez.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { randomInt, randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { notifyUser } from '@/lib/notify'
import { calculateProfileCompletion, type ProfileRecord } from '@/utils/profileCompletion'
import { isDeliveryOnTime, isPaymentOnTime } from '@/lib/collaboration-trust-shared'
import { applySpotlightReward, spotlightPlanCode } from '@/lib/tasks-shared'
import { grantSubscription, loadBillingSettings } from '@/lib/payments/subscriptions'
import {
  COLLAB_EARN_REASONS,
  DEFAULT_INFLUCASH_RULES,
  INFLUCASH_REASON_LABELS,
  clawbackEntries,
  dailyLoginAwards,
  istanbulDay,
  normalizeInflucashRules,
  redeemBlocker,
  spendableBalance,
  taskAward,
  type InflucashAudience,
  type InflucashReason,
  type InflucashRewardType,
  type InflucashRules,
  type LedgerLike,
} from '@/lib/influcash-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { success?: undefined; error: string }

export const INFLUCASH_LINK = '/dashboard/influcash'
export const INFLUCASH_SETTING_KEYS = ['influcash_enabled', 'influcash_partner_coupons_enabled', 'influcash_rules'] as const
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

export interface InflucashSettings {
  /** Tablolar canlıda mı. */
  ready: boolean
  enabled: boolean
  partnerCouponsEnabled: boolean
  rules: InflucashRules
}

const SETTINGS_TTL_MS = 30 * 1000
let settingsCache: { value: InflucashSettings; at: number } | null = null

export function resetInflucashCache() {
  settingsCache = null
}

function isMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === 'PGRST202' || error.code === '42P01' || /does not exist|schema cache|could not find/i.test(error.message ?? '')
}

export async function loadInflucashSettings(admin: SupabaseClient | null = createSupabaseAdminClient()): Promise<InflucashSettings> {
  const off: InflucashSettings = { ready: false, enabled: false, partnerCouponsEnabled: false, rules: { ...DEFAULT_INFLUCASH_RULES } }
  if (!admin) return off
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.value
  const [{ data, error }, probe] = await Promise.all([
    admin.from('platform_settings').select('key, value').in('key', [...INFLUCASH_SETTING_KEYS]),
    admin.from('influcash_balances').select('user_id', { head: true, count: 'exact' }).limit(1),
  ])
  if (error) console.error('[influcash] ayarlar okunamadı:', error.message)
  const raw: Record<string, unknown> = {}
  for (const row of data ?? []) raw[row.key as string] = row.value
  const ready = !probe.error
  if (probe.error && !isMissing(probe.error)) console.error('[influcash] tablo kontrolü:', probe.error.message)
  const value: InflucashSettings = {
    ready,
    enabled: ready && raw.influcash_enabled === true,
    partnerCouponsEnabled: ready && raw.influcash_partner_coupons_enabled === true,
    rules: normalizeInflucashRules(raw.influcash_rules),
  }
  settingsCache = { value, at: Date.now() }
  return value
}

export async function saveInflucashSettings(
  admin: SupabaseClient,
  adminUserId: string,
  patch: Partial<{ enabled: boolean; partnerCouponsEnabled: boolean; rules: InflucashRules }>,
) {
  const now = new Date().toISOString()
  const rows: Array<{ key: string; value: unknown; updated_at: string; updated_by: string }> = []
  if (patch.enabled !== undefined) rows.push({ key: 'influcash_enabled', value: patch.enabled, updated_at: now, updated_by: adminUserId })
  if (patch.partnerCouponsEnabled !== undefined) rows.push({ key: 'influcash_partner_coupons_enabled', value: patch.partnerCouponsEnabled, updated_at: now, updated_by: adminUserId })
  if (patch.rules) rows.push({ key: 'influcash_rules', value: patch.rules, updated_at: now, updated_by: adminUserId })
  if (!rows.length) return
  const { error } = await admin.from('platform_settings').upsert(rows, { onConflict: 'key' })
  resetInflucashCache()
  if (error) throw new Error(error.message)
}

// --- Hareket yazımı ----------------------------------------------------------------------------------

/**
 * Tek hareket. Kazanımlar yalnızca bayrak açıkken; geri alım ve admin düzeltmesi bayraktan bağımsız. Aynı hareket ikinci kez
 * yazılmaz (null). Yeni bakiye döner.
 */
export async function applyPoints(
  admin: SupabaseClient,
  input: { userId: string; amount: number; reason: InflucashReason; ref: string; note?: string | null; createdBy?: string | null },
  settings?: InflucashSettings,
): Promise<number | null> {
  if (!input.amount || !Number.isInteger(input.amount)) return null
  const s = settings ?? (await loadInflucashSettings(admin))
  if (!s.ready) return null
  if (!s.enabled && input.reason !== 'clawback' && input.reason !== 'admin_adjust') return null
  const { data, error } = await admin.rpc('influcash_apply', {
    p_user: input.userId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_ref: input.ref.slice(0, 120),
    p_note: input.note ? input.note.slice(0, 300) : null,
    p_created_by: input.createdBy ?? null,
  })
  if (error) {
    if (!isMissing(error)) console.error(`[influcash] ${input.reason} yazılamadı:`, error.message)
    return null
  }
  return typeof data === 'number' ? data : null
}

// --- Kazanımlar --------------------------------------------------------------------------------------

/**
 * Günlük giriş (İstanbul günü başına bir, 7 / 30 gün serisi, aylık üst sınır) ve bir kerelik ödüller (profil tamamlama,
 * hesap doğrulama). Web panelinde günde bir kez, mobilde uygulama açılışında çağrılır; tekrar çağrı zararsız.
 */
export async function awardDailyLogin(userId: string): Promise<{ awarded: number; balance: number | null }> {
  const admin = createSupabaseAdminClient()
  const none = { awarded: 0, balance: null }
  if (!admin) return none
  const settings = await loadInflucashSettings(admin)
  if (!settings.enabled) return none
  const { data: user } = await admin
    .from('users')
    .select('role, verification_status, full_name, username, city, bio, category, avatar_url, social_links')
    .eq('id', userId)
    .maybeSingle()
  if (!user || (user.role !== 'influencer' && user.role !== 'brand')) return none

  const now = new Date()
  const today = istanbulDay(now)
  const since = new Date(now.getTime() - 40 * 86_400_000).toISOString()
  const { data: rows } = await admin
    .from('influcash_ledger')
    .select('reason, ref, amount, created_at')
    .eq('user_id', userId)
    .in('reason', ['daily_login', 'login_streak', 'profile_complete', 'account_verified'])
    .gte('created_at', since)
    .limit(200)
  const ledger = (rows ?? []) as Array<{ reason: InflucashReason; ref: string; amount: number; created_at: string }>
  const loginDays = ledger.filter((r) => r.reason === 'daily_login').map((r) => r.ref)
  const month = today.slice(0, 7)
  const monthEarned = ledger
    .filter((r) => (r.reason === 'daily_login' || r.reason === 'login_streak') && istanbulDay(new Date(r.created_at)).slice(0, 7) === month)
    .reduce((sum, r) => sum + r.amount, 0)

  let awarded = 0
  let balance: number | null = null
  for (const a of dailyLoginAwards(settings.rules, loginDays, today, monthEarned)) {
    const b = await applyPoints(admin, { userId, amount: a.amount, reason: a.reason, ref: a.ref }, settings)
    if (b !== null) {
      awarded += a.amount
      balance = b
    }
  }

  // Bir kerelik ödüller (ref 'once'; benzersiz kısıt ikinci kez yazmayı engeller).
  const once: Array<{ reason: InflucashReason; amount: number; ok: boolean }> = [
    { reason: 'account_verified', amount: settings.rules.account_verified, ok: user.verification_status === 'verified' },
    {
      reason: 'profile_complete',
      amount: settings.rules.profile_complete,
      ok: calculateProfileCompletion(user as unknown as ProfileRecord, user.role as 'influencer' | 'brand').percent >= 100,
    },
  ]
  for (const o of once) {
    if (!o.ok || o.amount <= 0) continue
    const b = await applyPoints(admin, { userId, amount: o.amount, reason: o.reason, ref: 'once' }, settings)
    if (b !== null) {
      awarded += o.amount
      balance = b
      await notifyUser(
        { userId, event: 'influcash', title: `+${o.amount} Influcash`, message: `${INFLUCASH_REASON_LABELS[o.reason]}: ${o.amount} Influcash puanı kazandın.`, link: INFLUCASH_LINK, type: 'success' },
        admin,
      )
    }
  }
  return { awarded, balance }
}

/** Görev onayı (admin): görev türüne göre puan, gönderim başına bir kez. */
export async function awardTaskApproval(admin: SupabaseClient, userId: string, submissionId: string, kind: string) {
  const settings = await loadInflucashSettings(admin)
  if (!settings.enabled) return
  const amount = taskAward(settings.rules, kind)
  if (amount <= 0) return
  const b = await applyPoints(admin, { userId, amount, reason: 'task', ref: submissionId }, settings)
  if (b !== null) {
    await notifyUser(
      { userId, event: 'influcash', title: `+${amount} Influcash`, message: `Onaylanan görev için ${amount} Influcash puanı kazandın.`, link: INFLUCASH_LINK, type: 'success' },
      admin,
    )
  }
}

/**
 * İş birliği kazanımları: iki taraf ödemeyi teyit ettiyse (iptal değil) iki tarafa "tamamlanan iş birliği", vadesinde ödeyen markaya
 * "zamanında ödeme", tarihinde teslim edilen her teslimat için influencer'a "zamanında teslim". Her biri bir kez (referans = kimlik).
 * Haklı bulunmuş (upheld) anlaşmazlığı olan iş birliğinde kazanım yok.
 */
export async function awardCollaboration(admin: SupabaseClient, collaborationId: string, settings?: InflucashSettings): Promise<number> {
  const s = settings ?? (await loadInflucashSettings(admin))
  if (!s.enabled) return 0
  const [{ data: collab }, { data: payment }] = await Promise.all([
    admin.from('collaborations').select('id, brand_id, influencer_id, status, title').eq('id', collaborationId).maybeSingle(),
    admin.from('collaboration_payments').select('brand_paid_at, brand_paid_date, influencer_received_at').eq('collaboration_id', collaborationId).maybeSingle(),
  ])
  if (!collab || collab.status === 'cancelled' || !payment?.brand_paid_at || !payment?.influencer_received_at) return 0
  const { data: upheld } = await admin.from('collaboration_disputes').select('id').eq('collaboration_id', collaborationId).eq('status', 'upheld').limit(1)
  if (upheld?.length) return 0

  const [{ data: agreement }, { data: deliverables }] = await Promise.all([
    admin.from('collaboration_agreements').select('payment_due_date').eq('collaboration_id', collaborationId).maybeSingle(),
    admin.from('collaboration_deliverables').select('id, due_date, approved_at, published_at').eq('collaboration_id', collaborationId),
  ])
  let count = 0
  const add = async (userId: string, amount: number, reason: InflucashReason, ref: string) => {
    if (amount <= 0) return
    if ((await applyPoints(admin, { userId, amount, reason, ref, note: (collab.title as string | null)?.slice(0, 120) ?? null }, s)) !== null) count++
  }
  await add(collab.brand_id as string, s.rules.collab_completed, 'collab_completed', collab.id as string)
  await add(collab.influencer_id as string, s.rules.collab_completed, 'collab_completed', collab.id as string)
  if (isPaymentOnTime(payment.brand_paid_date as string | null, (agreement as { payment_due_date?: string | null } | null)?.payment_due_date ?? null)) {
    await add(collab.brand_id as string, s.rules.ontime_payment, 'ontime_payment', collab.id as string)
  }
  for (const d of (deliverables ?? []) as Array<{ id: string; due_date: string | null; approved_at: string | null; published_at: string | null }>) {
    if (isDeliveryOnTime(d)) await add(collab.influencer_id as string, s.rules.ontime_delivery, 'ontime_delivery', d.id)
  }
  if (count > 0) {
    for (const userId of [collab.brand_id as string, collab.influencer_id as string]) {
      await notifyUser(
        { userId, event: 'influcash', title: 'Influcash kazandın', message: `"${collab.title}" iş birliği için Influcash puanı hesabına eklendi.`, link: INFLUCASH_LINK, type: 'success' },
        admin,
      )
    }
  }
  return count
}

/** Saatlik görev: son 30 günde iki tarafça teyit edilen ödemeler (kaçan anlık ödülleri tamamlar). */
export async function sweepInflucashCollaborations(admin: SupabaseClient, opts: { limit?: number; deadline?: number } = {}) {
  const settings = await loadInflucashSettings(admin)
  if (!settings.enabled) return { skipped: settings.ready ? 'disabled' : 'tables_missing' }
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await admin
    .from('collaboration_payments')
    .select('collaboration_id')
    .not('brand_paid_at', 'is', null)
    .not('influencer_received_at', 'is', null)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (error) throw new Error(error.message)
  let awarded = 0
  for (const row of (data ?? []) as Array<{ collaboration_id: string }>) {
    if (opts.deadline && Date.now() > opts.deadline) break
    awarded += await awardCollaboration(admin, row.collaboration_id, settings)
  }
  return { checked: (data ?? []).length, awarded }
}

/**
 * Geri alım: iptal edilen iş birliği ya da haklı bulunan anlaşmazlık. İş birliği ve teslimat kimliklerine bağlı kazanımlar için
 * eksi hareket (iki taraf). Bakiye eksiye düşebilir; harcamada eksi bakiye 0 sayılır.
 */
export async function clawbackCollaboration(admin: SupabaseClient, collaborationId: string): Promise<number> {
  const settings = await loadInflucashSettings(admin)
  if (!settings.ready || !isUuid(collaborationId)) return 0
  const { data: collab } = await admin.from('collaborations').select('brand_id, influencer_id').eq('id', collaborationId).maybeSingle()
  if (!collab) return 0
  const { data: deliverables } = await admin.from('collaboration_deliverables').select('id').eq('collaboration_id', collaborationId)
  const refs = [collaborationId, ...((deliverables ?? []) as Array<{ id: string }>).map((d) => d.id)]
  let count = 0
  for (const userId of [collab.brand_id as string, collab.influencer_id as string]) {
    const clawRefs = refs.flatMap((r) => COLLAB_EARN_REASONS.map((reason) => `${reason}:${r}`))
    const [{ data: earned }, { data: done }] = await Promise.all([
      admin.from('influcash_ledger').select('reason, ref, amount').eq('user_id', userId).in('reason', COLLAB_EARN_REASONS).in('ref', refs),
      admin.from('influcash_ledger').select('reason, ref, amount').eq('user_id', userId).eq('reason', 'clawback').in('ref', clawRefs),
    ])
    const entries = clawbackEntries([...((earned ?? []) as LedgerLike[]), ...((done ?? []) as LedgerLike[])], refs)
    for (const e of entries) {
      if ((await applyPoints(admin, { userId, amount: e.amount, reason: 'clawback', ref: e.ref, note: 'İş birliği iptal edildi ya da anlaşmazlık haklı bulundu.' }, settings)) !== null) count++
    }
  }
  return count
}

// --- Görünüm ---------------------------------------------------------------------------------------------

export interface InflucashCatalogItem {
  id: string
  title: string
  description: string | null
  cost: number
  audience: InflucashAudience
  reward_type: InflucashRewardType
  plan: 'basic' | 'pro' | null
  days: number | null
  percent: number | null
  partner_name: string | null
  active: boolean
  stock: number | null
  sort_order: number
}

export interface InflucashOverview {
  enabled: boolean
  balance: number
  spendable: number
  history: Array<{ id: number; amount: number; reason: InflucashReason; label: string; note: string | null; createdAt: string }>
  catalog: Array<InflucashCatalogItem & { blocker: string | null }>
  redemptions: Array<{ id: string; title: string; cost: number; rewardType: string; code: string | null; status: string | null; createdAt: string }>
  rules: InflucashRules
  salesOpen: boolean
}

const CATALOG_COLUMNS = 'id, title, description, cost, audience, reward_type, plan, days, percent, partner_name, active, stock, sort_order'
const audienceFor = (role: string | null | undefined): 'creator' | 'brand' | null => (role === 'brand' ? 'brand' : role === 'influencer' ? 'creator' : null)

export async function balanceOf(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin.from('influcash_balances').select('balance').eq('user_id', userId).maybeSingle()
  return (data?.balance as number | undefined) ?? 0
}

/** Küçük bakiye çipi için: özellik kapalıysa null. */
export async function influcashChip(userId: string): Promise<number | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const settings = await loadInflucashSettings(admin)
  if (!settings.enabled) return null
  return spendableBalance(await balanceOf(admin, userId))
}

export async function getInflucashOverview(userId: string): Promise<InflucashOverview | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const settings = await loadInflucashSettings(admin)
  if (!settings.enabled) return null
  const { data: user } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  const audience = audienceFor(user?.role as string | null)
  if (!audience) return null
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const [balance, { data: history }, { data: items }, { data: redemptions }, { count: recent }, billing] = await Promise.all([
    balanceOf(admin, userId),
    admin.from('influcash_ledger').select('id, amount, reason, note, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    admin.from('influcash_catalog').select(CATALOG_COLUMNS).eq('active', true).in('audience', ['all', audience]).order('sort_order').order('cost'),
    admin.from('influcash_redemptions').select('id, item_title, cost, reward_type, task_reward_id, coupon_code, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    admin.from('influcash_redemptions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
    loadBillingSettings(admin),
  ])
  const redemptionRows = (redemptions ?? []) as Array<{ id: string; item_title: string; cost: number; reward_type: string; task_reward_id: string | null; coupon_code: string | null; created_at: string }>
  const rewardIds = redemptionRows.map((r) => r.task_reward_id).filter((v): v is string => !!v)
  const { data: rewards } = rewardIds.length ? await admin.from('task_rewards').select('id, code, status, used_at').in('id', rewardIds) : { data: [] }
  const rewardOf = new Map(((rewards ?? []) as Array<{ id: string; code: string | null; status: string; used_at?: string | null }>).map((r) => [r.id, r]))
  const catalog = ((items ?? []) as InflucashCatalogItem[])
    .filter((i) => i.reward_type !== 'partner_coupon' || settings.partnerCouponsEnabled)
    .map((i) => ({
      ...i,
      blocker: redeemBlocker(i, { audience, balance, partnerCouponsEnabled: settings.partnerCouponsEnabled, recentRedemptions: recent ?? 0, hourlyLimit: settings.rules.redeem_hourly_limit }),
    }))
  return {
    enabled: true,
    balance,
    spendable: spendableBalance(balance),
    history: ((history ?? []) as Array<{ id: number; amount: number; reason: InflucashReason; note: string | null; created_at: string }>).map((h) => ({
      id: h.id,
      amount: h.amount,
      reason: h.reason,
      label: INFLUCASH_REASON_LABELS[h.reason] ?? h.reason,
      note: h.note,
      createdAt: h.created_at,
    })),
    catalog,
    redemptions: redemptionRows.map((r) => {
      const reward = r.task_reward_id ? rewardOf.get(r.task_reward_id) : null
      const status =
        r.reward_type === 'discount_percent'
          ? reward?.used_at
            ? 'Kullanıldı'
            : 'Kullanılabilir (ödeme sayfasında)'
          : r.reward_type === 'spotlight_days'
            ? reward?.status === 'applied'
              ? 'Hesaba işlendi'
              : 'Satış başlayınca hesaba işlenir'
            : null
      return { id: r.id, title: r.item_title, cost: r.cost, rewardType: r.reward_type, code: reward?.code ?? r.coupon_code ?? null, status, createdAt: r.created_at }
    }),
    rules: settings.rules,
    salesOpen: billing.payments_enabled,
  }
}

// --- Harcama ----------------------------------------------------------------------------------------------

function discountCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = 'IM-'
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}

const REDEEM_ERRORS: Record<string, string> = {
  influcash_item_unavailable: 'Bu ödül şu an alınamaz (stok bitmiş ya da kapalı olabilir).',
  influcash_rate_limited: 'Çok sık harcama yaptın. Biraz sonra tekrar dene.',
  influcash_insufficient: 'Influcash bakiyen yetmiyor.',
}

/** Katalogdan ödül alır (tek veritabanı işlemi). Spotlight günü satış açıksa hemen işlenir, değilse satış başlayınca. */
export async function redeemItem(userId: string, itemId: unknown): Promise<Result<{ message: string; balance: number; code: string | null }>> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik.' }
  const settings = await loadInflucashSettings(admin)
  if (!settings.enabled) return { error: 'Influcash şu an kapalı.' }
  if (!isUuid(itemId)) return { error: 'Ödül bulunamadı.' }
  const { data: user } = await admin.from('users').select('id, role, spotlight_active, spotlight_plan, spotlight_expires_at').eq('id', userId).maybeSingle()
  const audience = audienceFor(user?.role as string | null)
  if (!user || !audience) return { error: 'Influcash yalnızca influencer, UGC ve marka hesaplarında.' }
  const { data: item } = await admin.from('influcash_catalog').select(CATALOG_COLUMNS).eq('id', itemId).maybeSingle()
  if (!item) return { error: 'Ödül bulunamadı.' }
  const catalogItem = item as InflucashCatalogItem
  if (catalogItem.reward_type === 'partner_coupon' && !settings.partnerCouponsEnabled) return { error: 'Bu ödül şu an alınamaz.' }
  const billing = await loadBillingSettings(admin)

  let balance: number | null = null
  let redemptionId = ''
  let code: string | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    redemptionId = randomUUID()
    code = catalogItem.reward_type === 'discount_percent' ? discountCode() : null
    const { data, error } = await admin.rpc('influcash_redeem', {
      p_user: userId,
      p_item: catalogItem.id,
      p_audience: audience,
      p_redemption_id: redemptionId,
      p_code: code,
      p_hourly_limit: settings.rules.redeem_hourly_limit,
      p_reward_status: 'pending',
    })
    if (!error) {
      balance = typeof data === 'number' ? data : 0
      break
    }
    const known = Object.keys(REDEEM_ERRORS).find((k) => error.message?.includes(k))
    if (known) return { error: REDEEM_ERRORS[known] }
    // Kod çakışması: yeni kodla yeniden dene.
    if (error.code === '23505' && /code/.test(error.message ?? '')) continue
    console.error('[influcash] harcama:', error.message)
    return { error: 'Ödül alınamadı. Lütfen tekrar dene.' }
  }
  if (balance === null) return { error: 'Ödül alınamadı. Lütfen tekrar dene.' }

  let message = 'Ödül alındı.'
  if (catalogItem.reward_type === 'discount_percent') {
    message = `İndirim kodun hazır: ${code}. Spotlight ödeme sayfasında kullanabilirsin.`
  } else if (catalogItem.reward_type === 'spotlight_days') {
    message = `${catalogItem.days} gün Spotlight ${catalogItem.plan === 'pro' ? 'Pro' : 'Basic'} satış başlayınca hesabına işlenir.`
    if (billing.payments_enabled && catalogItem.plan && catalogItem.days) {
      // Satış açık: görev ödülüyle aynı yol (abonelik kaydı, kaynak "reward"; syncUserSpotlight görür).
      const planCode = spotlightPlanCode(user.role as string, catalogItem.plan)
      const next = planCode ? applySpotlightReward(user as { spotlight_active: boolean | null; spotlight_plan: string | null; spotlight_expires_at: string | null }, planCode, catalogItem.days) : null
      if (next) {
        const granted = await grantSubscription(admin, { userId, plan: next.plan, source: 'reward', end: next.expiresAt, note: `Influcash ${redemptionId}` })
        if (granted.ok) {
          await admin.from('task_rewards').update({ status: 'applied', applied_at: new Date().toISOString(), applied_plan: next.plan, applied_until: next.expiresAt }).eq('id', redemptionId)
          message = `${catalogItem.days} gün Spotlight ${catalogItem.plan === 'pro' ? 'Pro' : 'Basic'} hesabına işlendi.`
        }
      }
    }
  } else {
    const { data: coupon } = await admin.from('influcash_redemptions').select('coupon_code').eq('id', redemptionId).maybeSingle()
    code = (coupon?.coupon_code as string | null) ?? null
    message = `Kupon kodun: ${code ?? '—'} (${catalogItem.partner_name ?? 'iş ortağı'}).`
  }
  await notifyUser({ userId, event: 'influcash', title: 'Influcash ödülü alındı', message: `${catalogItem.title}: ${message}`, link: INFLUCASH_LINK, type: 'success' }, admin)
  return { success: true, message, balance, code }
}

// --- Admin ---------------------------------------------------------------------------------------------

export interface InflucashAdminData {
  settings: InflucashSettings
  catalog: Array<InflucashCatalogItem & { freeCoupons: number }>
  recent: Array<{ id: number; userId: string; userLabel: string; amount: number; reason: InflucashReason; note: string | null; createdAt: string }>
  totals: { issued: number; spent: number; holders: number }
}

async function labelsFor(admin: SupabaseClient, ids: string[]) {
  const map = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from('users').select('id, full_name, username, email').in('id', ids.slice(i, i + 200))
    for (const u of (data ?? []) as Array<{ id: string; full_name: string | null; username: string | null; email: string | null }>) {
      map.set(u.id, `${u.full_name || u.email || 'Kullanıcı'}${u.username ? ` (@${u.username})` : ''}`)
    }
  }
  return map
}

export async function loadInflucashAdmin(admin: SupabaseClient): Promise<InflucashAdminData> {
  resetInflucashCache()
  const settings = await loadInflucashSettings(admin)
  if (!settings.ready) return { settings, catalog: [], recent: [], totals: { issued: 0, spent: 0, holders: 0 } }
  const [{ data: items }, { data: coupons }, { data: recent }, { data: sums }, { count: holders }] = await Promise.all([
    admin.from('influcash_catalog').select(CATALOG_COLUMNS).order('sort_order').order('created_at'),
    admin.from('influcash_partner_coupons').select('item_id').is('assigned_to', null).limit(10000),
    admin.from('influcash_ledger').select('id, user_id, amount, reason, note, created_at').order('created_at', { ascending: false }).limit(50),
    admin.from('influcash_ledger').select('amount').limit(50000),
    admin.from('influcash_balances').select('user_id', { count: 'exact', head: true }).gt('balance', 0),
  ])
  const free = new Map<string, number>()
  for (const c of (coupons ?? []) as Array<{ item_id: string }>) free.set(c.item_id, (free.get(c.item_id) ?? 0) + 1)
  const recentRows = (recent ?? []) as Array<{ id: number; user_id: string; amount: number; reason: InflucashReason; note: string | null; created_at: string }>
  const labels = await labelsFor(admin, Array.from(new Set(recentRows.map((r) => r.user_id))))
  let issued = 0
  let spent = 0
  for (const s of (sums ?? []) as Array<{ amount: number }>) {
    if (s.amount > 0) issued += s.amount
    else spent += -s.amount
  }
  return {
    settings,
    catalog: ((items ?? []) as InflucashCatalogItem[]).map((i) => ({ ...i, freeCoupons: free.get(i.id) ?? 0 })),
    recent: recentRows.map((r) => ({ id: r.id, userId: r.user_id, userLabel: labels.get(r.user_id) ?? r.user_id, amount: r.amount, reason: r.reason, note: r.note, createdAt: r.created_at })),
    totals: { issued, spent, holders: holders ?? 0 },
  }
}

export interface CatalogInput {
  id?: unknown
  title?: unknown
  description?: unknown
  cost?: unknown
  audience?: unknown
  reward_type?: unknown
  plan?: unknown
  days?: unknown
  percent?: unknown
  partner_name?: unknown
  active?: unknown
  stock?: unknown
  sort_order?: unknown
}

const intOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number.isInteger(Number(v)) ? Number(v) : NaN)

export function validateCatalogInput(input: CatalogInput): { row: Omit<InflucashCatalogItem, 'id'> } | { error: string } {
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 120) : ''
  if (title.length < 2) return { error: 'Ödül adını yazın.' }
  const cost = intOrNull(input.cost)
  if (cost === null || Number.isNaN(cost) || cost < 1 || cost > 1_000_000) return { error: 'Puan 1 ile 1.000.000 arasında tam sayı olmalı.' }
  const audience = (['creator', 'brand', 'all'] as const).find((a) => a === input.audience)
  if (!audience) return { error: 'Kitleyi seçin.' }
  const rewardType = (['spotlight_days', 'discount_percent', 'partner_coupon'] as const).find((a) => a === input.reward_type)
  if (!rewardType) return { error: 'Ödül türünü seçin.' }
  const stock = intOrNull(input.stock)
  if (Number.isNaN(stock) || (stock !== null && stock < 0)) return { error: 'Stok boş ya da 0 ve üzeri tam sayı olmalı.' }
  const sort = intOrNull(input.sort_order) ?? 0
  const row: Omit<InflucashCatalogItem, 'id'> = {
    title,
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 500) || null : null,
    cost,
    audience,
    reward_type: rewardType,
    plan: null,
    days: null,
    percent: null,
    partner_name: null,
    active: input.active === true,
    stock,
    sort_order: Number.isNaN(sort) ? 0 : sort,
  }
  if (rewardType === 'spotlight_days') {
    const days = intOrNull(input.days)
    if (input.plan !== 'basic' && input.plan !== 'pro') return { error: 'Spotlight paketini seçin.' }
    if (days === null || Number.isNaN(days) || days < 1 || days > 365) return { error: 'Gün 1 ile 365 arasında olmalı.' }
    row.plan = input.plan
    row.days = days
  } else if (rewardType === 'discount_percent') {
    const percent = intOrNull(input.percent)
    if (percent === null || Number.isNaN(percent) || percent < 1 || percent > 90) return { error: 'İndirim yüzdesi 1 ile 90 arasında olmalı.' }
    row.percent = percent
  } else {
    const partner = typeof input.partner_name === 'string' ? input.partner_name.trim().slice(0, 120) : ''
    if (partner.length < 2) return { error: 'İş ortağının adını yazın.' }
    row.partner_name = partner
  }
  return { row }
}

export async function saveCatalogItem(admin: SupabaseClient, input: CatalogInput): Promise<Result> {
  const checked = validateCatalogInput(input)
  if ('error' in checked) return { error: checked.error }
  const now = new Date().toISOString()
  const { error } = isUuid(input.id)
    ? await admin.from('influcash_catalog').update({ ...checked.row, updated_at: now }).eq('id', input.id)
    : await admin.from('influcash_catalog').insert(checked.row)
  if (error) return { error: `Kaydedilemedi: ${error.message}` }
  return { success: true }
}

/** İş ortağı kupon kodları (satır başına bir kod). Yalnızca altyapı; arayüzde bayrak kapalıyken kullanıcıya görünmez. */
export async function addPartnerCoupons(admin: SupabaseClient, itemId: unknown, codesText: unknown): Promise<Result<{ added: number }>> {
  if (!isUuid(itemId)) return { error: 'Ödül bulunamadı.' }
  const codes = Array.from(new Set(String(codesText ?? '').split(/\r?\n/).map((c) => c.trim()).filter((c) => c.length >= 3 && c.length <= 64))).slice(0, 1000)
  if (!codes.length) return { error: 'En az bir kod yazın (satır başına bir).' }
  const { data, error } = await admin
    .from('influcash_partner_coupons')
    .upsert(codes.map((code) => ({ item_id: itemId, code })), { onConflict: 'item_id,code', ignoreDuplicates: true })
    .select('id')
  if (error) return { error: error.message }
  return { success: true, added: (data ?? []).length }
}

export async function lookupLedger(admin: SupabaseClient, query: string) {
  const q = query.trim().replace(/^@/, '')
  if (!q) return null
  let userQuery = admin.from('users').select('id, full_name, username, email, role').limit(1)
  userQuery = UUID_RE.test(q) ? userQuery.eq('id', q) : q.includes('@') ? userQuery.ilike('email', q) : userQuery.ilike('username', q)
  const { data: user } = await userQuery.maybeSingle()
  if (!user) return null
  const [balance, { data: rows }] = await Promise.all([
    balanceOf(admin, user.id as string),
    admin.from('influcash_ledger').select('id, amount, reason, ref, note, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
  ])
  return {
    user: { id: user.id as string, label: `${user.full_name || user.email || 'Kullanıcı'}${user.username ? ` (@${user.username})` : ''}`, role: user.role as string | null },
    balance,
    rows: ((rows ?? []) as Array<{ id: number; amount: number; reason: InflucashReason; ref: string; note: string | null; created_at: string }>).map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      label: INFLUCASH_REASON_LABELS[r.reason] ?? r.reason,
      ref: r.ref,
      note: r.note,
      createdAt: r.created_at,
    })),
  }
}

/** Admin elle düzeltme: neden zorunlu (kullanıcının geçmişinde görünür). */
export async function adjustBalanceAsAdmin(admin: SupabaseClient, adminUserId: string, userId: unknown, amountInput: unknown, noteInput: unknown): Promise<Result<{ balance: number }>> {
  if (!isUuid(userId)) return { error: 'Kullanıcı bulunamadı.' }
  const amount = Number(amountInput)
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000) return { error: 'Tutar 0 olmayan, en fazla ±100.000 tam sayı olmalı.' }
  const note = typeof noteInput === 'string' ? noteInput.trim().slice(0, 300) : ''
  if (note.length < 3) return { error: 'Düzeltmenin nedenini yazın (kullanıcıya görünür).' }
  const settings = await loadInflucashSettings(admin)
  if (!settings.ready) return { error: 'Influcash tabloları canlıda yok.' }
  const balance = await applyPoints(admin, { userId, amount, reason: 'admin_adjust', ref: randomUUID(), note, createdBy: adminUserId }, settings)
  if (balance === null) return { error: 'Düzeltme yazılamadı.' }
  await notifyUser(
    { userId, event: 'influcash', title: 'Influcash düzeltmesi', message: `${amount > 0 ? '+' : ''}${amount} Influcash: ${note}`, link: INFLUCASH_LINK },
    admin,
  )
  return { success: true, balance }
}
