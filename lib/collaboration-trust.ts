// Güvenli iş birliği: taahhüt, hesap kısıtları, hatırlatmalar, gecikme sayıları (2026-11-23; SYSTEM_MAP 15).
// Kurallar lib/collaboration-trust-shared.ts'te. Tablolar (supabase/manual/2026-11-23_guvenli_is_birligi.sql) canlıda yoksa
// her şey eski davranışa düşer: taahhüt istenmez, vade zorunlu değil, hatırlatma ve kısıt yok. Hiçbir işlem çökmez.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { notifyUser } from '@/lib/notify'
import {
  ACCOUNT_HOLD_ERROR,
  ACCOUNT_SUSPENDED_ERROR,
  COMMITMENT_REQUIRED_ERROR,
  COMMITMENT_SHORT,
  COMMITMENT_VERSION,
  PAYMENT_REMINDER_DAYS,
  RECEIPT_REMINDER_DAYS,
  dueReminderStep,
  isDeliveryOnTime,
  isPaymentOnTime,
  paymentReminderBase,
  workFinishedAt,
} from '@/lib/collaboration-trust-shared'
import { formatTry } from '@/lib/collaboration-workspace-shared'

export { ACCOUNT_HOLD_ERROR, ACCOUNT_SUSPENDED_ERROR, COMMITMENT_REQUIRED_ERROR } from '@/lib/collaboration-trust-shared'

const READY_TTL_MS = 5 * 60 * 1000
const NOT_READY_TTL_MS = 60 * 1000
let readyCache: { value: boolean; at: number } | null = null

/** Tablo canlıda yok (PostgREST şema önbelleği ya da Postgres hatası) ya da kolon yok. */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /does not exist|schema cache|could not find/i.test(error.message ?? '')
  )
}

/** Güvenli iş birliği tabloları canlıda mı (kısa süreli önbellekli). */
export async function trustReady(admin: SupabaseClient | null = createSupabaseAdminClient()): Promise<boolean> {
  if (!admin) return false
  if (readyCache && Date.now() - readyCache.at < (readyCache.value ? READY_TTL_MS : NOT_READY_TTL_MS)) return readyCache.value
  const [disputes, due] = await Promise.all([
    admin.from('collaboration_disputes').select('id', { head: true, count: 'exact' }).limit(1),
    admin.from('collaboration_agreements').select('payment_due_date').limit(1),
  ])
  const value = !disputes.error && !due.error
  if (disputes.error && !isMissingRelation(disputes.error)) console.error('[trust] tablo kontrolü:', disputes.error.message)
  readyCache = { value, at: Date.now() }
  return value
}

/** Testler ve admin işlemleri sonrası önbelleği temizler. */
export function resetTrustReadyCache() {
  readyCache = null
}

// --- Taahhüt --------------------------------------------------------------------------------------

export interface CommitmentStatus {
  /** Özellik açık mı (tablo canlıda). Kapalıysa taahhüt istenmez. */
  required: boolean
  accepted: boolean
  acceptedAt: string | null
  version: string
}

export async function getCommitmentStatus(userId: string, admin: SupabaseClient | null = createSupabaseAdminClient()): Promise<CommitmentStatus> {
  const base: CommitmentStatus = { required: false, accepted: true, acceptedAt: null, version: COMMITMENT_VERSION }
  if (!admin || !(await trustReady(admin))) return base
  const { data: user } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  if (user?.role !== 'brand') return base
  const { data, error } = await admin
    .from('collaboration_commitments')
    .select('accepted_at')
    .eq('user_id', userId)
    .eq('text_version', COMMITMENT_VERSION)
    .maybeSingle()
  if (error) {
    if (!isMissingRelation(error)) console.error('[trust] taahhüt okunamadı:', error.message)
    return base
  }
  return { required: true, accepted: !!data, acceptedAt: (data?.accepted_at as string | undefined) ?? null, version: COMMITMENT_VERSION }
}

/** Markanın taahhüdü kabul etmesi (web aksiyonu ve mobil uç). Yalnızca marka; tekrar kabul zararsız. */
export async function acceptCommitment(
  userId: string,
  input: { version?: unknown; accepted?: unknown },
  source: 'web' | 'mobile',
): Promise<{ success: true; acceptedAt: string } | { success?: undefined; error: string }> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik.' }
  if (input.accepted !== true) return { error: 'Devam etmek için kutuyu işaretle.' }
  if (input.version !== COMMITMENT_VERSION) return { error: 'Taahhüt metni güncellendi. Sayfayı yenileyip tekrar dene.' }
  const { data: user } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  if (user?.role !== 'brand') return { error: 'Taahhüt yalnızca marka hesapları içindir.' }
  if (!(await trustReady(admin))) return { error: 'Bu özellik henüz açılmadı.' }
  const now = new Date().toISOString()
  const { error } = await admin
    .from('collaboration_commitments')
    .upsert({ user_id: userId, text_version: COMMITMENT_VERSION, accepted_at: now, source }, { onConflict: 'user_id,text_version', ignoreDuplicates: true })
  if (error) {
    console.error('[trust] taahhüt kaydedilemedi:', error.message)
    return { error: 'Kaydedilemedi. Lütfen tekrar dene.' }
  }
  return { success: true, acceptedAt: now }
}

// --- Hesap kısıtları ------------------------------------------------------------------------------

export interface AccountHold {
  id: string
  kind: 'review' | 'suspended'
  disputeId: string | null
  reason: string | null
  createdAt: string
}

export async function activeHoldsFor(userId: string, admin: SupabaseClient | null = createSupabaseAdminClient()): Promise<AccountHold[]> {
  if (!admin || !(await trustReady(admin))) return []
  const { data, error } = await admin
    .from('account_holds')
    .select('id, kind, dispute_id, reason, created_at')
    .eq('user_id', userId)
    .is('released_at', null)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    if (!isMissingRelation(error)) console.error('[trust] kısıtlar okunamadı:', error.message)
    return []
  }
  return ((data ?? []) as Array<{ id: string; kind: 'review' | 'suspended'; dispute_id: string | null; reason: string | null; created_at: string }>).map((h) => ({
    id: h.id,
    kind: h.kind,
    disputeId: h.dispute_id,
    reason: h.reason,
    createdAt: h.created_at,
  }))
}

export type TrustGateCode = 'commitment' | 'hold'

/**
 * Yeni ilan / teklif (marka) ya da ilan başvurusu (influencer) öncesi kontrol. Engel yoksa null.
 * Marka: geçerli sürümde taahhüt + aktif kısıt yok. Influencer: aktif kısıt yok. Tablolar yoksa her zaman null.
 */
export async function trustGateFor(userId: string, action: 'offer' | 'advert' | 'application'): Promise<{ error: string; code: TrustGateCode } | null> {
  const admin = createSupabaseAdminClient()
  if (!admin || !(await trustReady(admin))) return null
  const holds = await activeHoldsFor(userId, admin)
  if (holds.length) return { error: holds.some((h) => h.kind === 'suspended') ? ACCOUNT_SUSPENDED_ERROR : ACCOUNT_HOLD_ERROR, code: 'hold' }
  if (action === 'application') return null
  const status = await getCommitmentStatus(userId, admin)
  if (status.required && !status.accepted) return { error: COMMITMENT_REQUIRED_ERROR, code: 'commitment' }
  return null
}

/** DB tetikleyicisinin (enforce_trust_rules) hata mesajını kullanıcı metnine çevirir. */
export function trustErrorFromDb(message: string | null | undefined): { error: string; code: TrustGateCode } | null {
  if (!message) return null
  if (message.includes('trust_commitment_required')) return { error: COMMITMENT_REQUIRED_ERROR, code: 'commitment' }
  if (message.includes('trust_account_hold')) return { error: ACCOUNT_HOLD_ERROR, code: 'hold' }
  return null
}

// --- Gecikme sayıları (güvenilirlik bloğu) ------------------------------------------------------------

export interface LateStats {
  /** Marka: vadeli ve ödenmiş iş birliği / bunlardan geç ödenen. */
  payments: { total: number; late: number }
  /** Influencer: tarihli ve teslim edilmiş teslimat / bunlardan geç teslim edilen. */
  deliveries: { total: number; late: number }
}

const EMPTY_LATE: LateStats = { payments: { total: 0, late: 0 }, deliveries: { total: 0, late: 0 } }

/** Kullanıcının gecikme sayıları (yalnızca sayım; satırlar dışarı çıkmaz). Rol markaysa ödeme, influencer'sa teslim. */
export async function lateStatsFor(userId: string, role: 'brand' | 'influencer', admin: SupabaseClient | null = createSupabaseAdminClient()): Promise<LateStats> {
  if (!admin || !(await trustReady(admin))) return EMPTY_LATE
  const column = role === 'brand' ? 'brand_id' : 'influencer_id'
  const { data: collabs, error } = await admin.from('collaborations').select('id').eq(column, userId).neq('status', 'cancelled').limit(1000)
  if (error || !collabs?.length) return EMPTY_LATE
  const ids = collabs.map((c) => c.id as string)
  const out: LateStats = { payments: { total: 0, late: 0 }, deliveries: { total: 0, late: 0 } }
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    if (role === 'brand') {
      const [{ data: agreements }, { data: payments }] = await Promise.all([
        admin.from('collaboration_agreements').select('collaboration_id, payment_due_date').in('collaboration_id', chunk),
        admin.from('collaboration_payments').select('collaboration_id, brand_paid_date').in('collaboration_id', chunk),
      ])
      const due = new Map(((agreements ?? []) as Array<{ collaboration_id: string; payment_due_date: string | null }>).map((a) => [a.collaboration_id, a.payment_due_date]))
      for (const p of (payments ?? []) as Array<{ collaboration_id: string; brand_paid_date: string | null }>) {
        const onTime = isPaymentOnTime(p.brand_paid_date, due.get(p.collaboration_id))
        if (onTime === null) continue
        out.payments.total++
        if (!onTime) out.payments.late++
      }
    } else {
      const { data: deliverables } = await admin
        .from('collaboration_deliverables')
        .select('due_date, approved_at, published_at')
        .in('collaboration_id', chunk)
      for (const d of (deliverables ?? []) as Array<{ due_date: string | null; approved_at: string | null; published_at: string | null }>) {
        const onTime = isDeliveryOnTime(d)
        if (onTime === null) continue
        out.deliveries.total++
        if (!onTime) out.deliveries.late++
      }
    }
  }
  return out
}

// --- Hatırlatmalar (saatlik görev) -------------------------------------------------------------------

interface ReminderCollab {
  id: string
  brand_id: string
  influencer_id: string
  title: string
  status: string
  completed_at: string | null
}

const collabLink = (id: string) => `/dashboard/collaborations/${id}`

/** Bütün teslimatlar onaylandıysa son onay zamanı (lib/collaboration-workspace.ts ile aynı kural). */
function allApprovedAt(rows: Array<{ status: string; approved_at: string | null; reviewed_at: string | null; published_at: string | null; updated_at: string | null }>) {
  if (!rows.length) return null
  let latest = 0
  for (const d of rows) {
    if (d.status !== 'approved' && d.status !== 'published') return null
    const at = d.approved_at ?? d.reviewed_at ?? d.published_at ?? d.updated_at
    const t = at ? new Date(at).getTime() : NaN
    if (!Number.isFinite(t)) return null
    latest = Math.max(latest, t)
  }
  return new Date(latest).toISOString()
}

/**
 * Ödeme hatırlatmaları. Marka: iş bitti, vade geldi, iki taraf teyit etmedi → 0 / 3 / 7 / 14. gün (site içi + push + e-posta).
 * Influencer: marka "ödeme yapıldı" dedi, influencer teyit etmedi → 2 / 5 / 10. gün. Gönderilen adım günlüğe yazılır, tekrar gitmez.
 * Açık "ödeme alınamadı" anlaşmazlığı olan iş birliğinde markaya hatırlatma gitmez (anlaşmazlık akışı sürer).
 */
export async function processPaymentReminders(admin: SupabaseClient, opts: { limit?: number; deadline?: number } = {}) {
  const summary = { checked: 0, brand: 0, influencer: 0, skipped: false as boolean | string }
  if (!(await trustReady(admin))) {
    summary.skipped = 'tables_missing'
    return summary
  }
  const limit = opts.limit ?? 40
  const now = new Date()

  // Teyidi eksik ödemesi olan, iptal edilmemiş iş birlikleri (yalnızca anlaşma özeti olanlar; vade orada).
  const { data: agreements, error } = await admin
    .from('collaboration_agreements')
    .select('collaboration_id, payment_due_date, fee_amount, payment_type, brand_confirmed_at, influencer_confirmed_at')
    .eq('payment_type', 'cash')
    .not('brand_confirmed_at', 'is', null)
    .not('influencer_confirmed_at', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(500)
  if (error) throw new Error(`anlaşmalar okunamadı: ${error.message}`)
  const agreementRows = (agreements ?? []) as Array<{ collaboration_id: string; payment_due_date: string | null; fee_amount: number | null }>
  if (!agreementRows.length) return summary

  const ids = agreementRows.map((a) => a.collaboration_id)
  const [{ data: collabs }, { data: payments }, { data: reminders }, { data: disputes }] = await Promise.all([
    admin.from('collaborations').select('id, brand_id, influencer_id, title, status, completed_at').in('id', ids).neq('status', 'cancelled'),
    admin.from('collaboration_payments').select('collaboration_id, brand_paid_at, brand_paid_date, influencer_received_at').in('collaboration_id', ids),
    admin.from('collaboration_reminders').select('collaboration_id, kind, step').in('collaboration_id', ids),
    admin.from('collaboration_disputes').select('collaboration_id').in('collaboration_id', ids).eq('kind', 'nonpayment').in('status', ['open', 'responded', 'escalated']),
  ])
  const paymentOf = new Map(((payments ?? []) as Array<{ collaboration_id: string; brand_paid_at: string | null; brand_paid_date: string | null; influencer_received_at: string | null }>).map((p) => [p.collaboration_id, p]))
  const sentOf = new Map<string, number[]>()
  for (const r of (reminders ?? []) as Array<{ collaboration_id: string; kind: string; step: number }>) {
    const key = `${r.collaboration_id}:${r.kind}`
    sentOf.set(key, [...(sentOf.get(key) ?? []), r.step])
  }
  const disputed = new Set(((disputes ?? []) as Array<{ collaboration_id: string }>).map((d) => d.collaboration_id))
  const agreementOf = new Map(agreementRows.map((a) => [a.collaboration_id, a]))

  const pending = ((collabs ?? []) as ReminderCollab[]).filter((c) => {
    const p = paymentOf.get(c.id)
    return !(p?.brand_paid_at && p?.influencer_received_at) && !p?.influencer_received_at
  })
  if (!pending.length) return summary

  const { data: deliverableRows } = await admin
    .from('collaboration_deliverables')
    .select('collaboration_id, status, approved_at, reviewed_at, published_at, updated_at')
    .in('collaboration_id', pending.map((c) => c.id))
  const deliverablesOf = new Map<string, Array<{ status: string; approved_at: string | null; reviewed_at: string | null; published_at: string | null; updated_at: string | null }>>()
  for (const d of (deliverableRows ?? []) as Array<{ collaboration_id: string; status: string; approved_at: string | null; reviewed_at: string | null; published_at: string | null; updated_at: string | null }>) {
    deliverablesOf.set(d.collaboration_id, [...(deliverablesOf.get(d.collaboration_id) ?? []), d])
  }

  let sent = 0
  for (const collab of pending) {
    if (sent >= limit || (opts.deadline && Date.now() > opts.deadline)) break
    summary.checked++
    const agreement = agreementOf.get(collab.id)
    const payment = paymentOf.get(collab.id)
    const finished = workFinishedAt(collab.status === 'completed' ? collab.completed_at : null, allApprovedAt(deliverablesOf.get(collab.id) ?? []))
    const fee = agreement?.fee_amount ? ` (${formatTry(agreement.fee_amount)})` : ''

    if (!payment?.brand_paid_at) {
      if (disputed.has(collab.id)) continue
      const base = paymentReminderBase(agreement?.payment_due_date ?? null, finished)
      const step = dueReminderStep(base, now, PAYMENT_REMINDER_DAYS, sentOf.get(`${collab.id}:payment_brand`) ?? [])
      if (step === null) continue
      if (!(await claimReminder(admin, collab.id, 'payment_brand', step))) continue
      const dueText = agreement?.payment_due_date ? ` Ödeme vadesi: ${new Date(`${agreement.payment_due_date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ''
      const lead =
        step === 0
          ? `"${collab.title}" iş birliğinin ödemesi${fee} bekleniyor.`
          : `"${collab.title}" iş birliğinin ödemesi${fee} ${step} gündür bekleniyor.`
      await notifyUser(
        {
          userId: collab.brand_id,
          event: 'collab_payment_reminder',
          title: step === 0 ? 'Ödeme bekleniyor' : `Ödeme hâlâ bekleniyor (${step}. gün)`,
          message: `${lead}${dueText} Ödemeyi yaptıysanız iş birliği sayfasında "Ödeme yapıldı" olarak işaretleyin. ${COMMITMENT_SHORT}`,
          link: collabLink(collab.id),
          type: step >= 7 ? 'warning' : 'info',
        },
        admin,
      )
      summary.brand++
      sent++
      continue
    }

    // Marka ödedi, influencer teyit etmedi.
    const step = dueReminderStep(payment.brand_paid_at, now, RECEIPT_REMINDER_DAYS, sentOf.get(`${collab.id}:receipt_influencer`) ?? [])
    if (step === null) continue
    if (!(await claimReminder(admin, collab.id, 'receipt_influencer', step))) continue
    await notifyUser(
      {
        userId: collab.influencer_id,
        event: 'collab_receipt_reminder',
        title: 'Ödemeyi teyit et',
        message: `Marka "${collab.title}" iş birliğinin ödemesini${fee} yaptığını işaretledi. Ödemeyi aldıysan "Ödeme alındı" ile teyit et; almadıysan iş birliği sayfasından bildir.`,
        link: collabLink(collab.id),
      },
      admin,
    )
    summary.influencer++
    sent++
  }
  return summary
}

/** Hatırlatma adımını günlüğe yazar; aynı adım zaten yazıldıysa false (iki görev aynı anda çalışırsa yalnızca biri gönderir). */
async function claimReminder(admin: SupabaseClient, collaborationId: string, kind: 'payment_brand' | 'receipt_influencer', step: number) {
  const { data, error } = await admin
    .from('collaboration_reminders')
    .upsert({ collaboration_id: collaborationId, kind, step }, { onConflict: 'collaboration_id,kind,step', ignoreDuplicates: true })
    .select('step')
  if (error) {
    console.error('[trust] hatırlatma günlüğü:', error.message)
    return false
  }
  return (data ?? []).length > 0
}

/** İş birliği sayfasında gösterilen gönderilmiş hatırlatmalar (iki taraf da görür). */
export async function remindersFor(collaborationId: string, admin: SupabaseClient | null = createSupabaseAdminClient()) {
  if (!admin || !(await trustReady(admin))) return []
  const { data } = await admin.from('collaboration_reminders').select('kind, step, sent_at').eq('collaboration_id', collaborationId).order('sent_at')
  return ((data ?? []) as Array<{ kind: 'payment_brand' | 'receipt_influencer'; step: number; sent_at: string }>).map((r) => ({ kind: r.kind, step: r.step, sentAt: r.sent_at }))
}
