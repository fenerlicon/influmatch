// İş birliği takip alanı (yol haritası özellik 2, SYSTEM_MAP 3.18):
//   - Anlaşma özeti: teslimatlar, ücret + ödeme türü, tarihler, kullanım hakkı, revize sayısı. Bir taraf yazar, diğeri onaylar;
//     iki onay zaman damgasıyla tutulur. Onaydan sonra yapılan her değişiklik iki onayı da sıfırlar (değişikliği kaydeden tarafın
//     kaydı yeni sürümü onayı sayılır, karşı taraf yeniden onaylar). Hukuki şablon metni yok (avukattan gelecek).
//   - Teslimat takibi: bekliyor → taslak gönderildi → revize istendi → onaylandı → yayınlandı. Taslak bugün yalnızca link
//     (http/https); dosya yükleme ve teslim kilidi R2 ile gelecek (collaboration_submissions.file_key / file_locked).
//     Revize sayısı anlaşmadaki sınırla karşılaştırılır; sınır dolunca marka yeni revize isteyemez. Bütün teslimatlar yayınlanınca
//     iş birliği "published" olur ve mevcut 7 günlük marka onayı / otomatik tamamlama işler.
//   - Ödeme teyidi: marka "Ödeme yapıldı", influencer "Ödeme alındı" işaretler. Tamamlanmadan 14 gün sonra teyit yoksa influencer
//     "Ödeme alamadım" ile admin'e destek kaydı (Ödeme Sorunu) açar, markaya bildirim gider. Otomatik yaptırım yok.
//
// Okumalar oturumdaki kullanıcının RLS'li istemcisiyle (yalnızca taraflar); yazımların hepsi burada, taraf ve rol kontrolünden
// sonra service role ile. Web sunucu aksiyonu ve mobil uç (/api/mobile/collaborations/[id]) aynı fonksiyonları çağırır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { listCollaborationsFor, validatePublishUrl, type CollaborationListItem, type CollaborationRow } from '@/lib/collaborations'
import { ticketCode } from '@/lib/support-ticket'
import {
  AGREEMENT_LIMITS,
  DELIVERABLE_KIND_LABELS,
  DELIVERABLE_KINDS,
  NONPAYMENT_REPORT_DAYS,
  PAYMENT_TYPE_LABELS,
  WORKSPACE_ACTIONS,
  formatTry,
  type AgreementInput,
  type AgreementPaymentType,
  type DeliverableAction,
  type DeliverableKind,
  type DeliverableStatus,
  type WorkspaceActionName,
} from '@/lib/collaboration-workspace-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

const DAY_MS = 24 * 60 * 60 * 1000
const EDITABLE_STATUSES = ['agreed', 'in_progress']
const PAYMENT_STATUSES = ['agreed', 'in_progress', 'published', 'completed']

export const detailLink = (collaborationId: string) => `/dashboard/collaborations/${collaborationId}`

export interface AgreementRow {
  collaboration_id: string
  fee_amount: number | null
  payment_type: AgreementPaymentType
  usage_rights: string | null
  revision_limit: number
  version: number
  drafted_by: string | null
  updated_by: string | null
  brand_confirmed_at: string | null
  influencer_confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface DeliverableRow {
  id: string
  collaboration_id: string
  position: number
  kind: DeliverableKind
  quantity: number
  note: string | null
  due_date: string | null
  status: DeliverableStatus
  revisions_used: number
  draft_url: string | null
  draft_note: string | null
  draft_submitted_at: string | null
  review_note: string | null
  reviewed_at: string | null
  approved_at: string | null
  publish_url: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface SubmissionRow {
  id: string
  deliverable_id: string
  submitted_by: string | null
  url: string | null
  note: string | null
  review: 'approved' | 'revision_requested' | null
  review_note: string | null
  reviewed_at: string | null
  created_at: string
}

export interface PaymentRow {
  collaboration_id: string
  brand_paid_at: string | null
  brand_paid_date: string | null
  brand_note: string | null
  influencer_received_at: string | null
  influencer_received_date: string | null
  influencer_note: string | null
  nonpayment_reported_at: string | null
  nonpayment_ticket_id: string | null
}

export interface DeliverableView extends DeliverableRow {
  actions: DeliverableAction[]
  submissions: SubmissionRow[]
}

export interface CollaborationWorkspace {
  collaboration: CollaborationListItem
  agreement: AgreementRow | null
  agreementConfirmed: boolean
  deliverables: DeliverableView[]
  payment: PaymentRow | null
  permissions: {
    canEditAgreement: boolean
    canConfirmAgreement: boolean
    canMarkPaid: boolean
    canUnmarkPaid: boolean
    canConfirmPayment: boolean
    canUnconfirmPayment: boolean
    canReportNonpayment: boolean
    /** "Ödeme alamadım" düğmesinin açılacağı an (tamamlanmış ve teyitsizse). */
    nonpaymentAvailableAt: string | null
  }
  brandReliability: { completed: number; confirmed: number }
}

const AGREEMENT_COLUMNS =
  'collaboration_id, fee_amount, payment_type, usage_rights, revision_limit, version, drafted_by, updated_by, brand_confirmed_at, influencer_confirmed_at, created_at, updated_at'
const DELIVERABLE_COLUMNS =
  'id, collaboration_id, position, kind, quantity, note, due_date, status, revisions_used, draft_url, draft_note, draft_submitted_at, review_note, reviewed_at, approved_at, publish_url, published_at, created_at, updated_at'
const SUBMISSION_COLUMNS = 'id, deliverable_id, submitted_by, url, note, review, review_note, reviewed_at, created_at'
const PAYMENT_COLUMNS =
  'collaboration_id, brand_paid_at, brand_paid_date, brand_note, influencer_received_at, influencer_received_date, influencer_note, nonpayment_reported_at, nonpayment_ticket_id'
const COLLAB_COLUMNS =
  'id, brand_id, influencer_id, source, offer_id, application_id, title, status, publish_url, published_at, completed_at, auto_completed, cancelled_at, cancelled_by, cancel_reason, room_id, created_at, updated_at'

const isConfirmed = (a: Pick<AgreementRow, 'brand_confirmed_at' | 'influencer_confirmed_at'> | null) =>
  !!a && !!a.brand_confirmed_at && !!a.influencer_confirmed_at

// --- Doğrulama -------------------------------------------------------------------------------

const cleanText = (raw: unknown, max: number) => (typeof raw === 'string' ? raw.trim().slice(0, max) : '')

/** YYYY-AA-GG; geçerli takvim günü. */
function parseDateOnly(raw: unknown): string | null | 'invalid' {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'invalid'
  const d = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return 'invalid'
  return raw
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const shiftDays = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)

/** Taslak linki: http(s), kullanıcı adı/şifre içermeyen geçerli adres (Drive, WeTransfer, önizleme vb.). */
export function validateDraftUrl(raw: unknown): { url: string } | { error: string } {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return { error: 'Taslak linkini girin.' }
  if (value.length > 500) return { error: 'Link en fazla 500 karakter olabilir.' }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { error: 'Geçerli bir link girin (https:// ile başlamalı).' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { error: 'Link http veya https ile başlamalı.' }
  if (parsed.username || parsed.password || !parsed.hostname.includes('.')) return { error: 'Geçerli bir link girin.' }
  return { url: parsed.toString() }
}

interface NormalizedAgreement {
  fee_amount: number | null
  payment_type: AgreementPaymentType
  usage_rights: string | null
  revision_limit: number
  deliverables: Array<{ id: string | null; kind: DeliverableKind; quantity: number; note: string | null; due_date: string | null }>
}

function normalizeAgreement(raw: unknown, existingDueDates: Map<string, string | null>): { value: NormalizedAgreement } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Anlaşma bilgileri eksik.' }
  const input = raw as Partial<AgreementInput>
  const paymentType: AgreementPaymentType = input.payment_type === 'barter' ? 'barter' : 'cash'

  let fee: number | null = null
  if (input.fee_amount !== null && input.fee_amount !== undefined && (input.fee_amount as unknown) !== '') {
    const n = Number(input.fee_amount)
    if (!Number.isInteger(n) || n < 0 || n > AGREEMENT_LIMITS.maxFee) return { error: 'Ücret 0 ile 10.000.000 ₺ arasında tam sayı olmalı.' }
    fee = n
  }
  if (paymentType === 'cash' && (fee === null || fee < 1)) return { error: 'Nakit ödemede anlaşılan ücreti girin.' }

  const revision = Number(input.revision_limit)
  if (!Number.isInteger(revision) || revision < 0 || revision > AGREEMENT_LIMITS.maxRevisions) {
    return { error: `Revize sayısı 0 ile ${AGREEMENT_LIMITS.maxRevisions} arasında olmalı.` }
  }

  const list = Array.isArray(input.deliverables) ? input.deliverables : []
  if (list.length === 0) return { error: 'En az bir teslimat ekleyin.' }
  if (list.length > AGREEMENT_LIMITS.maxDeliverables) return { error: `En fazla ${AGREEMENT_LIMITS.maxDeliverables} teslimat eklenebilir.` }

  const today = todayIso()
  const seen = new Set<string>()
  const deliverables: NormalizedAgreement['deliverables'] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') return { error: 'Teslimat bilgisi geçersiz.' }
    const kind = item.kind as DeliverableKind
    if (!DELIVERABLE_KINDS.includes(kind)) return { error: 'Teslimat türünü seçin.' }
    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > AGREEMENT_LIMITS.maxQuantity) {
      return { error: `Teslimat adedi 1 ile ${AGREEMENT_LIMITS.maxQuantity} arasında olmalı.` }
    }
    const id = typeof item.id === 'string' && item.id ? item.id : null
    if (id) {
      if (seen.has(id)) return { error: 'Teslimat listesi geçersiz.' }
      seen.add(id)
    }
    const due = parseDateOnly(item.due_date)
    if (due === 'invalid') return { error: 'Teslim tarihi geçersiz.' }
    // Yeni ya da değiştirilen tarih makul aralıkta olmalı; eski (geçmiş) tarih değişmeden kalabilir.
    if (due && (!id || existingDueDates.get(id) !== due) && (due < shiftDays(today, -1) || due > shiftDays(today, 3 * 365))) {
      return { error: 'Teslim tarihi bugünden önce veya 3 yıldan sonra olamaz.' }
    }
    deliverables.push({ id, kind, quantity, note: cleanText(item.note, AGREEMENT_LIMITS.deliverableNoteMax) || null, due_date: due })
  }

  return {
    value: {
      fee_amount: fee,
      payment_type: paymentType,
      usage_rights: cleanText(input.usage_rights, AGREEMENT_LIMITS.usageRightsMax) || null,
      revision_limit: revision,
      deliverables,
    },
  }
}

// --- Yetki / işlem listeleri --------------------------------------------------------------------

function deliverableActions(d: DeliverableRow, ctx: { isBrand: boolean; active: boolean; confirmed: boolean; revisionLimit: number }): DeliverableAction[] {
  if (!ctx.active || !ctx.confirmed) return []
  const actions: DeliverableAction[] = []
  if (!ctx.isBrand) {
    if (['pending', 'draft_submitted', 'revision_requested'].includes(d.status)) actions.push('submit_draft')
    if (d.status === 'approved') actions.push('publish_deliverable')
  } else if (d.status === 'draft_submitted') {
    actions.push('approve_draft')
    if (d.revisions_used < ctx.revisionLimit) actions.push('request_revision')
  }
  return actions
}

function nonpaymentAvailableAt(collab: Pick<CollaborationRow, 'status' | 'completed_at'>) {
  if (collab.status !== 'completed' || !collab.completed_at) return null
  return new Date(new Date(collab.completed_at).getTime() + NONPAYMENT_REPORT_DAYS * DAY_MS).toISOString()
}

function buildPermissions(collab: CollaborationRow, isBrand: boolean, agreement: AgreementRow | null, payment: PaymentRow | null) {
  const editable = EDITABLE_STATUSES.includes(collab.status)
  const ownConfirmation = agreement ? (isBrand ? agreement.brand_confirmed_at : agreement.influencer_confirmed_at) : null
  const paymentOpen = PAYMENT_STATUSES.includes(collab.status)
  const availableAt = nonpaymentAvailableAt(collab)
  return {
    canEditAgreement: editable,
    canConfirmAgreement: editable && !!agreement && !ownConfirmation,
    canMarkPaid: isBrand && paymentOpen,
    canUnmarkPaid: isBrand && paymentOpen && !!payment?.brand_paid_at,
    canConfirmPayment: !isBrand && paymentOpen,
    canUnconfirmPayment: !isBrand && paymentOpen && !!payment?.influencer_received_at,
    canReportNonpayment:
      !isBrand &&
      !!availableAt &&
      Date.now() >= new Date(availableAt).getTime() &&
      !payment?.influencer_received_at &&
      !payment?.nonpayment_reported_at,
    nonpaymentAvailableAt: !isBrand && availableAt && !payment?.influencer_received_at ? availableAt : null,
  }
}

// --- Okuma ---------------------------------------------------------------------------------------

/** Markaların güvenilirlik sayıları (tamamlanan iş birliği ve influencer'ın ödemeyi teyit ettiği). Satırlar gizli kalır. */
export async function brandReliability(supabase: SupabaseClient, brandIds: string[]) {
  const map = new Map<string, { completed: number; confirmed: number }>()
  const ids = Array.from(new Set(brandIds.filter(Boolean))).slice(0, 500)
  if (!ids.length) return map
  const { data, error } = await supabase.rpc('brand_collaboration_reliability', { p_brand_ids: ids })
  if (error) {
    console.error('[collaboration-workspace] güvenilirlik alınamadı:', error.message)
    return map
  }
  ;((data ?? []) as Array<{ brand_id: string; completed_count: number; payment_confirmed_count: number }>).forEach((r) =>
    map.set(r.brand_id, { completed: r.completed_count, confirmed: r.payment_confirmed_count }),
  )
  return map
}

/**
 * Detay sayfası verisi. supabase oturumdaki kullanıcının RLS'li istemcisidir (web çerezi / mobil Bearer):
 * taraf olmayan kullanıcı hiçbir satırı göremez ve "bulunamadı" alır.
 */
export async function getCollaborationWorkspace(
  supabase: SupabaseClient,
  userId: string,
  collaborationId: string,
): Promise<Result<{ workspace: CollaborationWorkspace }>> {
  if (!collaborationId || !/^[0-9a-f-]{36}$/i.test(collaborationId)) return { error: 'İş birliği bulunamadı.' }

  const listed = await listCollaborationsFor(supabase, userId, { id: collaborationId })
  if (!listed.success) return { error: listed.error }
  const collaboration = listed.collaborations[0]
  if (!collaboration) return { error: 'İş birliği bulunamadı.' }

  const [agreementRes, deliverablesRes, submissionsRes, paymentRes, reliability] = await Promise.all([
    supabase.from('collaboration_agreements').select(AGREEMENT_COLUMNS).eq('collaboration_id', collaborationId).maybeSingle(),
    supabase.from('collaboration_deliverables').select(DELIVERABLE_COLUMNS).eq('collaboration_id', collaborationId).order('position').order('created_at'),
    supabase
      .from('collaboration_submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('collaboration_id', collaborationId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('collaboration_payments').select(PAYMENT_COLUMNS).eq('collaboration_id', collaborationId).maybeSingle(),
    brandReliability(supabase, [collaboration.brand_id]),
  ])
  if (agreementRes.error || deliverablesRes.error || submissionsRes.error || paymentRes.error) {
    console.error(
      '[collaboration-workspace] okuma hatası:',
      agreementRes.error?.message ?? deliverablesRes.error?.message ?? submissionsRes.error?.message ?? paymentRes.error?.message,
    )
    return { error: 'İş birliği ayrıntıları yüklenemedi.' }
  }

  const agreement = (agreementRes.data ?? null) as AgreementRow | null
  const payment = (paymentRes.data ?? null) as PaymentRow | null
  const isBrand = collaboration.brand_id === userId
  const confirmed = isConfirmed(agreement)
  const active = EDITABLE_STATUSES.includes(collaboration.status)
  const submissions = (submissionsRes.data ?? []) as SubmissionRow[]
  const deliverables = ((deliverablesRes.data ?? []) as DeliverableRow[]).map((d) => ({
    ...d,
    actions: deliverableActions(d, { isBrand, active, confirmed, revisionLimit: agreement?.revision_limit ?? 0 }),
    submissions: submissions.filter((s) => s.deliverable_id === d.id),
  }))

  return {
    success: true,
    workspace: {
      collaboration,
      agreement,
      agreementConfirmed: confirmed,
      deliverables,
      payment,
      permissions: buildPermissions(collaboration, isBrand, agreement, payment),
      brandReliability: reliability.get(collaboration.brand_id) ?? { completed: 0, confirmed: 0 },
    },
  }
}

// --- Yazım ---------------------------------------------------------------------------------------

export interface WorkspaceActionInput {
  action: WorkspaceActionName
  agreement?: unknown
  version?: number | null
  deliverableId?: string | null
  url?: string | null
  note?: string | null
  date?: string | null
}

/** İstek gövdesini güvenli biçime çevirir (web aksiyonu ve mobil uç ortak). */
export function parseWorkspaceInput(body: unknown): WorkspaceActionInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!WORKSPACE_ACTIONS.includes(b.action as WorkspaceActionName)) return null
  return {
    action: b.action as WorkspaceActionName,
    agreement: b.agreement,
    version: typeof b.version === 'number' ? b.version : null,
    deliverableId: typeof b.deliverableId === 'string' ? b.deliverableId : null,
    url: typeof b.url === 'string' ? b.url : null,
    note: typeof b.note === 'string' ? b.note : null,
    date: typeof b.date === 'string' ? b.date : null,
  }
}

const stale = { error: 'İş birliği bu arada güncellenmiş. Sayfayı yenileyip tekrar deneyin.' } as const

function agreementSignature(a: Pick<NormalizedAgreement, 'fee_amount' | 'payment_type' | 'usage_rights' | 'revision_limit' | 'deliverables'>) {
  return JSON.stringify([
    a.fee_amount,
    a.payment_type,
    a.usage_rights,
    a.revision_limit,
    a.deliverables.map((d) => [d.id, d.kind, d.quantity, d.note, d.due_date]),
  ])
}

/**
 * Takip alanı işlemi. userId oturumdaki kullanıcıdır (web çerezi veya mobil Bearer ile doğrulanmış);
 * kullanıcı kaydın tarafı değilse ya da işlem rolüne / duruma uygun değilse reddedilir.
 */
export async function runWorkspaceAction(userId: string, collaborationId: string, input: WorkspaceActionInput): Promise<Result<{ message?: string }>> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  if (!collaborationId || !/^[0-9a-f-]{36}$/i.test(collaborationId)) return { error: 'İş birliği bulunamadı.' }

  const { data: collabData } = await admin.from('collaborations').select(COLLAB_COLUMNS).eq('id', collaborationId).maybeSingle()
  const collab = collabData as unknown as CollaborationRow | null
  if (!collab || (collab.brand_id !== userId && collab.influencer_id !== userId)) return { error: 'İş birliği bulunamadı.' }

  const isBrand = collab.brand_id === userId
  const otherId = isBrand ? collab.influencer_id : collab.brand_id
  const link = detailLink(collab.id)
  const now = new Date().toISOString()

  const { data: agreementData } = await admin.from('collaboration_agreements').select(AGREEMENT_COLUMNS).eq('collaboration_id', collab.id).maybeSingle()
  const agreement = (agreementData ?? null) as AgreementRow | null

  switch (input.action) {
    case 'save_agreement':
      return saveAgreement(admin, collab, agreement, userId, isBrand, otherId, input, now)

    case 'confirm_agreement': {
      if (!EDITABLE_STATUSES.includes(collab.status)) return { error: 'Bu iş birliğinde anlaşma özeti artık onaylanamaz.' }
      if (!agreement) return { error: 'Önce anlaşma özeti hazırlanmalı.' }
      if (input.version !== agreement.version) return stale
      const column = isBrand ? 'brand_confirmed_at' : 'influencer_confirmed_at'
      if (agreement[column]) return { success: true, message: 'Anlaşma özetini zaten onayladınız.' }
      const { data: updated } = await admin
        .from('collaboration_agreements')
        .update({ [column]: now })
        .eq('collaboration_id', collab.id)
        .eq('version', agreement.version)
        .is(column, null)
        .select('brand_confirmed_at, influencer_confirmed_at')
      if (!updated?.length) return stale
      const both = isConfirmed(updated[0] as AgreementRow)
      const name = await displayNameOf(admin, userId)
      await notifyUser(
        {
          userId: otherId,
          event: 'collab_agreement_confirmed',
          title: both ? 'Anlaşma özeti onaylandı' : 'Anlaşma özeti onaylandı (bir taraf)',
          message: both
            ? `"${collab.title}" anlaşma özeti iki tarafça onaylandı. Teslimatlar başlayabilir.`
            : `${name}, "${collab.title}" anlaşma özetini onayladı.`,
          link,
          type: 'success',
        },
        admin,
      )
      return { success: true, message: both ? 'Anlaşma özeti iki tarafça onaylandı.' : 'Onayınız kaydedildi. Karşı tarafın onayı bekleniyor.' }
    }

    case 'submit_draft':
    case 'approve_draft':
    case 'request_revision':
    case 'publish_deliverable':
      return deliverableAction(admin, collab, agreement, userId, isBrand, input, now)

    case 'mark_paid':
    case 'confirm_payment': {
      const expected = input.action === 'mark_paid'
      if (isBrand !== expected) return { error: 'Bu işlem şu an yapılamaz.' }
      if (!PAYMENT_STATUSES.includes(collab.status)) return { error: 'İptal edilen iş birliğinde ödeme işaretlenemez.' }
      const date = parseDateOnly(input.date || todayIso())
      if (date === 'invalid' || !date) return { error: 'Ödeme tarihi geçersiz.' }
      if (date > shiftDays(todayIso(), 1) || date < shiftDays(collab.created_at.slice(0, 10), -30)) {
        return { error: 'Ödeme tarihi ileri bir tarih ya da anlaşmadan çok önce olamaz.' }
      }
      const note = cleanText(input.note, AGREEMENT_LIMITS.paymentNoteMax) || null
      const patch = isBrand
        ? { brand_paid_at: now, brand_paid_date: date, brand_note: note }
        : { influencer_received_at: now, influencer_received_date: date, influencer_note: note }
      const { error } = await admin.from('collaboration_payments').upsert({ collaboration_id: collab.id, ...patch, updated_at: now }, { onConflict: 'collaboration_id' })
      if (error) {
        console.error('[collaboration-workspace] ödeme kaydı:', error.message)
        return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
      }
      const name = await displayNameOf(admin, userId)
      await notifyUser(
        {
          userId: otherId,
          event: 'collab_payment',
          title: isBrand ? 'Ödeme yapıldı olarak işaretlendi' : 'Ödeme alındı olarak teyit edildi',
          message: isBrand
            ? `${name}, "${collab.title}" iş birliğinin ödemesini yaptığını işaretledi. Ödemeyi aldıysanız "Ödeme alındı" ile teyit edin.`
            : `${name}, "${collab.title}" iş birliğinin ödemesini aldığını teyit etti.`,
          link,
          type: 'success',
        },
        admin,
      )
      return { success: true, message: isBrand ? 'Ödeme yapıldı olarak işaretlendi.' : 'Ödeme alındı olarak teyit edildi.' }
    }

    case 'unmark_paid':
    case 'unconfirm_payment': {
      const expected = input.action === 'unmark_paid'
      if (isBrand !== expected) return { error: 'Bu işlem şu an yapılamaz.' }
      const patch = isBrand
        ? { brand_paid_at: null, brand_paid_date: null, brand_note: null }
        : { influencer_received_at: null, influencer_received_date: null, influencer_note: null }
      const { error } = await admin.from('collaboration_payments').update({ ...patch, updated_at: now }).eq('collaboration_id', collab.id)
      if (error) return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
      return { success: true, message: 'İşaret kaldırıldı.' }
    }

    case 'report_nonpayment':
      return reportNonpayment(admin, collab, agreement, userId, isBrand, input, now)

    default:
      return { error: 'Geçersiz işlem.' }
  }
}

async function saveAgreement(
  admin: SupabaseClient,
  collab: CollaborationRow,
  agreement: AgreementRow | null,
  userId: string,
  isBrand: boolean,
  otherId: string,
  input: WorkspaceActionInput,
  now: string,
): Promise<Result<{ message?: string }>> {
  if (!EDITABLE_STATUSES.includes(collab.status)) return { error: 'Anlaşma özeti yalnızca süren iş birliğinde değiştirilebilir.' }
  if (agreement && input.version !== agreement.version) return stale

  const { data: existingData } = await admin.from('collaboration_deliverables').select(DELIVERABLE_COLUMNS).eq('collaboration_id', collab.id)
  const existing = (existingData ?? []) as DeliverableRow[]
  const existingById = new Map(existing.map((d) => [d.id, d]))

  const normalized = normalizeAgreement(input.agreement, new Map(existing.map((d) => [d.id, d.due_date])))
  if ('error' in normalized) return { error: normalized.error }
  const next = normalized.value

  for (const d of next.deliverables) {
    if (d.id && !existingById.has(d.id)) return stale
  }
  const keptIds = new Set(next.deliverables.map((d) => d.id).filter(Boolean) as string[])
  const removed = existing.filter((d) => !keptIds.has(d.id))
  if (removed.some((d) => d.status !== 'pending' || d.draft_submitted_at || d.revisions_used > 0)) {
    return { error: 'Taslağı gönderilmiş bir teslimat listeden çıkarılamaz.' }
  }
  if (agreement && next.revision_limit < Math.max(0, ...existing.map((d) => d.revisions_used))) {
    return { error: 'Revize sayısı, kullanılmış revize sayısından az olamaz.' }
  }

  // Değişiklik yoksa onaylar korunur.
  if (agreement) {
    const current = agreementSignature({
      fee_amount: agreement.fee_amount,
      payment_type: agreement.payment_type,
      usage_rights: agreement.usage_rights,
      revision_limit: agreement.revision_limit,
      deliverables: [...existing]
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
        .map((d) => ({ id: d.id, kind: d.kind, quantity: d.quantity, note: d.note, due_date: d.due_date })),
    })
    if (current === agreementSignature(next)) return { success: true, message: 'Değişiklik yok.' }
  }

  // Her değişiklik iki onayı sıfırlar; kaydeden tarafın kaydı yeni sürümün onayı sayılır.
  const confirmations = isBrand
    ? { brand_confirmed_at: now, influencer_confirmed_at: null }
    : { brand_confirmed_at: null, influencer_confirmed_at: now }
  const fields = {
    fee_amount: next.fee_amount,
    payment_type: next.payment_type,
    usage_rights: next.usage_rights,
    revision_limit: next.revision_limit,
    updated_by: userId,
    updated_at: now,
    ...confirmations,
  }

  if (agreement) {
    // Sürüm kilidi: aynı anda iki kayıtta ikincisi boşa düşer.
    const { data: updated, error } = await admin
      .from('collaboration_agreements')
      .update({ ...fields, version: agreement.version + 1 })
      .eq('collaboration_id', collab.id)
      .eq('version', agreement.version)
      .select('version')
    if (error) {
      console.error('[collaboration-workspace] anlaşma güncelleme:', error.message)
      return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
    }
    if (!updated?.length) return stale
  } else {
    const { error } = await admin.from('collaboration_agreements').insert({ collaboration_id: collab.id, drafted_by: userId, version: 1, ...fields })
    if (error) {
      if (error.code === '23505') return stale
      console.error('[collaboration-workspace] anlaşma ekleme:', error.message)
      return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
    }
  }

  // Teslimatlar: çıkarılanlar silinir (yalnızca hiç taslak almamış olanlar), mevcutlar güncellenir, yeniler eklenir.
  if (removed.length) {
    await admin
      .from('collaboration_deliverables')
      .delete()
      .in(
        'id',
        removed.map((d) => d.id),
      )
      .eq('status', 'pending')
      .is('draft_submitted_at', null)
  }
  const inserts: Record<string, unknown>[] = []
  await Promise.all(
    next.deliverables.map((d, position) => {
      const row = { kind: d.kind, quantity: d.quantity, note: d.note, due_date: d.due_date, position }
      if (d.id) {
        return admin.from('collaboration_deliverables').update({ ...row, updated_at: now }).eq('id', d.id).eq('collaboration_id', collab.id)
      }
      inserts.push({ ...row, collaboration_id: collab.id })
      return Promise.resolve()
    }),
  )
  if (inserts.length) {
    const { error } = await admin.from('collaboration_deliverables').insert(inserts)
    if (error) {
      console.error('[collaboration-workspace] teslimat ekleme:', error.message)
      return { error: 'Teslimatlar kaydedilemedi. Lütfen tekrar deneyin.' }
    }
  }

  const name = await displayNameOf(admin, userId)
  const first = !agreement
  const wasConfirmed = isConfirmed(agreement)
  await notifyUser(
    {
      userId: otherId,
      event: first ? 'collab_agreement' : 'collab_agreement_changed',
      title: first ? 'Anlaşma özeti hazırlandı' : 'Anlaşma özeti değişti',
      message: first
        ? `${name}, "${collab.title}" iş birliği için anlaşma özeti hazırladı. Kontrol edip onaylayın.`
        : `${name}, "${collab.title}" anlaşma özetini değiştirdi.${wasConfirmed ? ' Önceki onaylar sıfırlandı;' : ''} Yeni hali kontrol edip onaylayın.`,
      link: detailLink(collab.id),
      type: first ? 'info' : 'warning',
    },
    admin,
  )
  return { success: true, message: 'Anlaşma özeti kaydedildi. Karşı tarafın onayı bekleniyor.' }
}

async function deliverableAction(
  admin: SupabaseClient,
  collab: CollaborationRow,
  agreement: AgreementRow | null,
  userId: string,
  isBrand: boolean,
  input: WorkspaceActionInput,
  now: string,
): Promise<Result<{ message?: string }>> {
  if (!EDITABLE_STATUSES.includes(collab.status)) return { error: 'Bu iş birliğinde teslimat işlemi yapılamaz.' }
  if (!isConfirmed(agreement)) return { error: 'Teslimatlar, anlaşma özeti iki tarafça onaylandıktan sonra başlar.' }
  if (!input.deliverableId) return { error: 'Teslimat bulunamadı.' }

  const { data } = await admin
    .from('collaboration_deliverables')
    .select(DELIVERABLE_COLUMNS)
    .eq('id', input.deliverableId)
    .eq('collaboration_id', collab.id)
    .maybeSingle()
  const deliverable = data as DeliverableRow | null
  if (!deliverable) return { error: 'Teslimat bulunamadı.' }

  const allowed = deliverableActions(deliverable, { isBrand, active: true, confirmed: true, revisionLimit: agreement!.revision_limit })
  if (!allowed.includes(input.action as DeliverableAction)) {
    if (input.action === 'request_revision' && isBrand && deliverable.status === 'draft_submitted') {
      return { error: 'Anlaşmadaki revize hakkı doldu. Taslağı onaylayabilir ya da influencer ile sohbetten görüşebilirsiniz.' }
    }
    return { error: 'Bu işlem şu an yapılamaz. Sayfayı yenileyip tekrar deneyin.' }
  }

  const label = `${DELIVERABLE_KIND_LABELS[deliverable.kind]}${deliverable.quantity > 1 ? ` ×${deliverable.quantity}` : ''}`
  const link = detailLink(collab.id)
  const name = await displayNameOf(admin, userId)

  // Durum geçişi yalnızca okunan durumdan (aynı anda iki işlemde ikincisi boşa düşer).
  const transition = async (patch: Record<string, unknown>) => {
    const { data: updated, error } = await admin
      .from('collaboration_deliverables')
      .update({ ...patch, updated_at: now })
      .eq('id', deliverable.id)
      .eq('status', deliverable.status)
      .eq('revisions_used', deliverable.revisions_used)
      .select('id')
    if (error) console.error(`[collaboration-workspace] ${input.action}:`, error.message)
    return !error && (updated?.length ?? 0) > 0
  }
  const reviewLatest = async (review: 'approved' | 'revision_requested', note: string | null) => {
    const { data: latest } = await admin
      .from('collaboration_submissions')
      .select('id')
      .eq('deliverable_id', deliverable.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.id) await admin.from('collaboration_submissions').update({ review, review_note: note, reviewed_at: now }).eq('id', latest.id)
  }

  switch (input.action) {
    case 'submit_draft': {
      const checked = validateDraftUrl(input.url)
      if ('error' in checked) return { error: checked.error }
      const note = cleanText(input.note, AGREEMENT_LIMITS.draftNoteMax) || null
      if (!(await transition({ status: 'draft_submitted', draft_url: checked.url, draft_note: note, draft_submitted_at: now, review_note: null }))) return stale
      await admin.from('collaboration_submissions').insert({
        collaboration_id: collab.id,
        deliverable_id: deliverable.id,
        submitted_by: userId,
        url: checked.url,
        note,
      })
      if (collab.status === 'agreed') {
        await admin.from('collaborations').update({ status: 'in_progress', updated_at: now }).eq('id', collab.id).eq('status', 'agreed')
      }
      await notifyUser(
        {
          userId: collab.brand_id,
          event: 'collab_draft',
          title: 'Taslak gönderildi',
          message: `${name}, "${collab.title}" iş birliğinde ${label} için taslak gönderdi. İnceleyip onaylayın ya da revize isteyin.`,
          link,
        },
        admin,
      )
      return { success: true, message: 'Taslak gönderildi.' }
    }

    case 'approve_draft': {
      if (!(await transition({ status: 'approved', approved_at: now, reviewed_at: now }))) return stale
      await reviewLatest('approved', null)
      await notifyUser(
        {
          userId: collab.influencer_id,
          event: 'collab_deliverable_approved',
          title: 'Taslak onaylandı',
          message: `${name}, "${collab.title}" iş birliğinde ${label} taslağını onayladı. Yayınladığınızda linkini girin.`,
          link,
          type: 'success',
        },
        admin,
      )
      return { success: true, message: 'Taslak onaylandı.' }
    }

    case 'request_revision': {
      const note = cleanText(input.note, AGREEMENT_LIMITS.reviewNoteMax)
      if (note.length < 3) return { error: 'Revize isteğinizi kısaca yazın.' }
      const used = deliverable.revisions_used + 1
      if (!(await transition({ status: 'revision_requested', revisions_used: used, review_note: note, reviewed_at: now }))) return stale
      await reviewLatest('revision_requested', note)
      await notifyUser(
        {
          userId: collab.influencer_id,
          event: 'collab_revision',
          title: 'Revize istendi',
          message: `${name}, "${collab.title}" iş birliğinde ${label} için revize istedi (${used} / ${agreement!.revision_limit}): ${note}`,
          link,
          type: 'warning',
        },
        admin,
      )
      return { success: true, message: 'Revize isteği gönderildi.' }
    }

    case 'publish_deliverable': {
      const checked = validatePublishUrl(input.url)
      if ('error' in checked) return { error: checked.error }
      if (!(await transition({ status: 'published', publish_url: checked.url, published_at: now }))) return stale

      // Bütün teslimatlar yayınlandıysa iş birliği "yayında" olur; 7 günlük marka onayı / otomatik tamamlama başlar.
      const { data: rest } = await admin.from('collaboration_deliverables').select('status').eq('collaboration_id', collab.id)
      const allPublished = (rest ?? []).length > 0 && (rest ?? []).every((d) => d.status === 'published')
      if (allPublished) {
        const { data: moved } = await admin
          .from('collaborations')
          .update({ status: 'published', publish_url: checked.url, published_at: now, updated_at: now })
          .eq('id', collab.id)
          .in('status', EDITABLE_STATUSES)
          .select('id')
        if (moved?.length) {
          await notifyUser(
            {
              userId: collab.brand_id,
              event: 'collab_published',
              title: 'Bütün teslimatlar yayınlandı',
              message: `${name}, "${collab.title}" iş birliğinin bütün teslimatlarını yayınladı. İçerikleri kontrol edip iş birliğini onaylayın; 7 gün içinde yanıt verilmezse iş birliği otomatik tamamlanır.`,
              link,
            },
            admin,
          )
          return { success: true, message: 'Bütün teslimatlar yayınlandı. Marka onayladığında iş birliği tamamlanır.' }
        }
      }
      await notifyUser(
        {
          userId: collab.brand_id,
          event: 'collab_update',
          title: 'Teslimat yayınlandı',
          message: `${name}, "${collab.title}" iş birliğinde ${label} yayın linkini girdi.`,
          link,
        },
        admin,
      )
      return { success: true, message: 'Yayın linki kaydedildi.' }
    }

    default:
      return { error: 'Geçersiz işlem.' }
  }
}

async function reportNonpayment(
  admin: SupabaseClient,
  collab: CollaborationRow,
  agreement: AgreementRow | null,
  userId: string,
  isBrand: boolean,
  input: WorkspaceActionInput,
  now: string,
): Promise<Result<{ message?: string }>> {
  if (isBrand) return { error: 'Bu işlem şu an yapılamaz.' }
  const availableAt = nonpaymentAvailableAt(collab)
  if (!availableAt || Date.now() < new Date(availableAt).getTime()) {
    return { error: `Bu bildirim, iş birliği tamamlandıktan ${NONPAYMENT_REPORT_DAYS} gün sonra açılır.` }
  }

  // Tek bildirim: önce satır güvenceye alınır, sonra "bildirildi" işareti yalnızca boşsa yazılır.
  await admin.from('collaboration_payments').upsert({ collaboration_id: collab.id }, { onConflict: 'collaboration_id', ignoreDuplicates: true })
  const { data: claimed } = await admin
    .from('collaboration_payments')
    .update({ nonpayment_reported_at: now, updated_at: now })
    .eq('collaboration_id', collab.id)
    .is('nonpayment_reported_at', null)
    .is('influencer_received_at', null)
    .select('brand_paid_at, brand_paid_date')
  if (!claimed?.length) return { error: 'Bu iş birliği için bildirim zaten yapıldı ya da ödeme teyit edildi.' }

  const { data: brand } = await admin.from('users').select('full_name, username').eq('id', collab.brand_id).maybeSingle()
  const brandLabel = `${(brand?.full_name as string | null) || '—'}${brand?.username ? ` (@${brand.username})` : ''}`
  const paidInfo = claimed[0].brand_paid_at
    ? `Marka "ödeme yapıldı" işaretlemiş (${claimed[0].brand_paid_date ?? '—'}).`
    : 'Marka ödeme işaretlememiş.'
  const userNote = cleanText(input.note, 500)
  const message = [
    '[Ödeme alınamadı bildirimi]',
    `İş birliği: "${collab.title}" (${collab.id})`,
    `Marka: ${brandLabel}`,
    `Tamamlanma: ${collab.completed_at?.slice(0, 10) ?? '—'}`,
    `Anlaşma: ${agreement ? `${formatTry(agreement.fee_amount)} · ${PAYMENT_TYPE_LABELS[agreement.payment_type]}` : 'anlaşma özeti yok'}`,
    paidInfo,
    userNote ? `Influencer notu: ${userNote}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const { data: ticket, error } = await admin
    .from('support_tickets')
    .insert({ user_id: userId, subject: 'Ödeme Sorunu', priority: 'Acil', message, status: 'open' })
    .select('id')
    .single()
  if (error || !ticket) {
    console.error('[collaboration-workspace] ödeme bildirimi kaydı:', error?.message)
    await admin.from('collaboration_payments').update({ nonpayment_reported_at: null }).eq('collaboration_id', collab.id).eq('nonpayment_reported_at', now)
    return { error: 'Bildirim gönderilemedi. Lütfen tekrar deneyin.' }
  }
  await admin.from('collaboration_payments').update({ nonpayment_ticket_id: ticket.id }).eq('collaboration_id', collab.id)

  const name = await displayNameOf(admin, userId)
  await notifyUser(
    {
      userId: collab.brand_id,
      event: 'collab_nonpayment',
      title: 'Ödeme alınamadı bildirimi',
      message: `${name}, "${collab.title}" iş birliğinin ödemesini alamadığını bildirdi; destek ekibi inceleyecek. Ödemeyi yaptıysanız iş birliği sayfasında "Ödeme yapıldı" olarak işaretleyin.`,
      link: detailLink(collab.id),
      type: 'warning',
    },
    admin,
  )
  return { success: true, message: `Bildiriminiz destek ekibine iletildi (talep ${ticketCode(ticket.id as string)}).` }
}
