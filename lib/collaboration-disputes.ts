// Ödeme / teslim anlaşmazlıkları (2026-11-23; SYSTEM_MAP 15). Platform para tutmaz; yalnızca kayıt, süre ve hesap kısıtı.
//
// Akış: bildiren taraf (influencer "Ödeme alamadım" / marka "Teslim edilmedi") → karşı tarafa bildirim, 7 gün yanıt süresi
// (dekont / kanıt yükler, açıklama yazar ya da "çözüldü" der) → bildiren "çözüldü" diye teyit ederse kapanır.
// 7 gün içinde kanıt ya da yanıt yoksa saatlik görev anlaşmazlığı "İncelemede" yapar ve karşı tarafın hesabına inceleme kısıtı
// koyar (yeni ilan / teklif / başvuru kapalı). Son karar admin'in (kullanıcı kararı): askıya alma (karar kaydı + itiraz hakkı,
// lib/moderation.ts), kapatma ya da "ödendi" olarak kapatma. Yanıt verildiyse bildiren taraf da admin'e taşıyabilir.
//
// Tablolar istemcilere kapalı; okuma ve yazma burada service role ile, taraf kontrolünden sonra. Tablolar yoksa
// (supabase/manual/2026-11-23_guvenli_is_birligi.sql çalıştırılmadı) anlaşmazlık açılmaz, eski destek kaydı akışı sürer.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { parseDecisionReason, recordDecision, formatReason, type DecisionReasonInput } from '@/lib/moderation'
import { trustReady, isMissingRelation } from '@/lib/collaboration-trust'
import {
  ACTIVE_DISPUTE_STATUSES,
  COMMITMENT_SHORT,
  DISPUTE_KIND_LABELS,
  DISPUTE_NOTE_MAX,
  DISPUTE_PROOF_BUCKET,
  DISPUTE_RESPONSE_DAYS,
  DISPUTE_STATUS_LABELS,
  isOwnProofPath,
  nondeliveryAvailableAt,
  proofExtension,
  type DisputeKind,
  type DisputeStatus,
} from '@/lib/collaboration-trust-shared'
import { DELIVERABLE_KIND_LABELS, formatTry, type DeliverableKind } from '@/lib/collaboration-workspace-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

const DAY_MS = 24 * 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)
const collabLink = (id: string) => `/dashboard/collaborations/${id}`
const cleanText = (raw: unknown, max: number) => (typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').trim().slice(0, max) : '')

export const DISPUTE_COLUMNS =
  'id, collaboration_id, kind, deliverable_id, reporter_id, respondent_id, status, reporter_note, response_due_at, response_note, responded_at, proof_path, proof_uploaded_at, respondent_resolved_at, reporter_confirmed_at, escalated_at, decided_at, decided_by, decision_note, support_ticket_id, created_at, updated_at'

export interface DisputeRow {
  id: string
  collaboration_id: string
  kind: DisputeKind
  deliverable_id: string | null
  reporter_id: string
  respondent_id: string
  status: DisputeStatus
  reporter_note: string | null
  response_due_at: string
  response_note: string | null
  responded_at: string | null
  proof_path: string | null
  proof_uploaded_at: string | null
  respondent_resolved_at: string | null
  reporter_confirmed_at: string | null
  escalated_at: string | null
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
  support_ticket_id: string | null
  created_at: string
  updated_at: string
}

export type DisputeActionName = 'respond' | 'upload_proof' | 'mark_resolved' | 'confirm_resolved' | 'escalate'

export interface DisputeView {
  id: string
  kind: DisputeKind
  kindLabel: string
  status: DisputeStatus
  statusLabel: string
  deliverableId: string | null
  viewerIsReporter: boolean
  reporterNote: string | null
  openedAt: string
  responseDueAt: string
  responseNote: string | null
  respondedAt: string | null
  hasProof: boolean
  proofUploadedAt: string | null
  respondentResolvedAt: string | null
  reporterConfirmedAt: string | null
  escalatedAt: string | null
  decidedAt: string | null
  decisionNote: string | null
  actions: DisputeActionName[]
}

function actionsFor(d: DisputeRow, viewerId: string): DisputeActionName[] {
  const active = ACTIVE_DISPUTE_STATUSES.includes(d.status)
  if (!active) return []
  const out: DisputeActionName[] = []
  if (viewerId === d.respondent_id) {
    out.push('respond', 'upload_proof')
    if (!d.respondent_resolved_at) out.push('mark_resolved')
  }
  if (viewerId === d.reporter_id) {
    out.push('confirm_resolved')
    if (d.status === 'responded') out.push('escalate')
  }
  return out
}

export function disputeView(d: DisputeRow, viewerId: string): DisputeView {
  return {
    id: d.id,
    kind: d.kind,
    kindLabel: DISPUTE_KIND_LABELS[d.kind],
    status: d.status,
    statusLabel: DISPUTE_STATUS_LABELS[d.status] ?? d.status,
    deliverableId: d.deliverable_id,
    viewerIsReporter: d.reporter_id === viewerId,
    reporterNote: d.reporter_note,
    openedAt: d.created_at,
    responseDueAt: d.response_due_at,
    responseNote: d.response_note,
    respondedAt: d.responded_at,
    hasProof: !!d.proof_path,
    proofUploadedAt: d.proof_uploaded_at,
    respondentResolvedAt: d.respondent_resolved_at,
    reporterConfirmedAt: d.reporter_confirmed_at,
    escalatedAt: d.escalated_at,
    decidedAt: d.decided_at,
    decisionNote: d.decision_note,
    actions: actionsFor(d, viewerId),
  }
}

/** İş birliğinin anlaşmazlıkları (taraf kontrolünü çağıran yapar: getCollaborationWorkspace RLS'li okumayla doğrular). */
export async function disputesForCollaboration(collaborationId: string, viewerId: string, admin: SupabaseClient | null = createSupabaseAdminClient()): Promise<DisputeView[]> {
  if (!admin || !(await trustReady(admin))) return []
  const { data, error } = await admin
    .from('collaboration_disputes')
    .select(DISPUTE_COLUMNS)
    .eq('collaboration_id', collaborationId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    if (!isMissingRelation(error)) console.error('[disputes] okunamadı:', error.message)
    return []
  }
  return ((data ?? []) as DisputeRow[]).filter((d) => d.reporter_id === viewerId || d.respondent_id === viewerId).map((d) => disputeView(d, viewerId))
}

// --- Açma ----------------------------------------------------------------------------------------

interface OpenDisputeInput {
  collaborationId: string
  title: string
  kind: DisputeKind
  reporterId: string
  respondentId: string
  deliverableId?: string | null
  deliverableLabel?: string | null
  note?: string | null
  ticketId?: string | null
}

/** Anlaşmazlık açar ve karşı tarafa bildirir. Tablo yoksa ya da aynı tür açık kayıt varsa null. */
export async function openDispute(admin: SupabaseClient, input: OpenDisputeInput): Promise<{ id: string } | null> {
  if (!(await trustReady(admin))) return null
  const now = Date.now()
  const dueAt = new Date(now + DISPUTE_RESPONSE_DAYS * DAY_MS).toISOString()
  const { data, error } = await admin
    .from('collaboration_disputes')
    .insert({
      collaboration_id: input.collaborationId,
      kind: input.kind,
      deliverable_id: input.deliverableId ?? null,
      reporter_id: input.reporterId,
      respondent_id: input.respondentId,
      reporter_note: input.note ? input.note.slice(0, 500) : null,
      response_due_at: dueAt,
      support_ticket_id: input.ticketId ?? null,
    })
    .select('id')
    .maybeSingle()
  if (error || !data) {
    if (error?.code !== '23505') console.error('[disputes] açılamadı:', error?.message)
    return null
  }
  const name = await displayNameOf(admin, input.reporterId)
  const dueText = new Date(dueAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const message =
    input.kind === 'nonpayment'
      ? `${name}, "${input.title}" iş birliğinin ödemesini alamadığını bildirdi. ${dueText} tarihine kadar iş birliği sayfasından ödeme dekontunu yükleyin ya da durumu açıklayın; yanıt verilmezse hesabınız incelemeye alınır ve yeni ilan / teklif açamazsınız. ${COMMITMENT_SHORT}`
      : `${name}, "${input.title}" iş birliğinde ${input.deliverableLabel ?? 'bir teslimatın'} teslim edilmediğini bildirdi. ${dueText} tarihine kadar iş birliği sayfasından teslim kanıtını yükleyin ya da durumu açıklayın; yanıt verilmezse hesabınız incelemeye alınır ve yeni başvuru yapamazsınız.`
  await notifyUser(
    {
      userId: input.respondentId,
      event: 'collab_dispute',
      title: input.kind === 'nonpayment' ? 'Ödeme alınamadı bildirimi: 7 gün içinde yanıt verin' : 'Teslim edilmedi bildirimi: 7 gün içinde yanıt verin',
      message,
      link: collabLink(input.collaborationId),
      type: 'warning',
    },
    admin,
  )
  return { id: data.id as string }
}

// --- Taraf işlemleri -----------------------------------------------------------------------------------

export interface DisputeActionInput {
  action: 'report_nondelivery' | 'dispute_respond' | 'dispute_mark_resolved' | 'dispute_confirm_resolved' | 'dispute_escalate'
  disputeId?: string | null
  deliverableId?: string | null
  note?: string | null
  proofPath?: string | null
}

interface CollabLite {
  id: string
  brand_id: string
  influencer_id: string
  title: string
  status: string
}

async function loadDispute(admin: SupabaseClient, collaborationId: string, disputeId: unknown): Promise<DisputeRow | null> {
  if (!isUuid(disputeId)) return null
  const { data } = await admin.from('collaboration_disputes').select(DISPUTE_COLUMNS).eq('id', disputeId).eq('collaboration_id', collaborationId).maybeSingle()
  return (data as DisputeRow | null) ?? null
}

async function proofExists(admin: SupabaseClient, path: string) {
  const parts = path.split('/')
  const { data } = await admin.storage.from(DISPUTE_PROOF_BUCKET).list(`${parts[0]}/${parts[1]}`, { search: parts[2], limit: 1 })
  return !!data?.some((f) => f.name === parts[2])
}

async function releaseHolds(admin: SupabaseClient, disputeId: string, by: string | null) {
  await admin.from('account_holds').update({ released_at: new Date().toISOString(), released_by: by }).eq('dispute_id', disputeId).is('released_at', null)
}

/**
 * Takip alanından gelen anlaşmazlık işlemi (lib/collaboration-workspace.ts runWorkspaceAction yönlendirir).
 * Kullanıcının iş birliği tarafı olduğu çağıranda doğrulandı; burada rol ve duruma göre kontrol edilir.
 */
export async function runDisputeAction(admin: SupabaseClient, collab: CollabLite, userId: string, input: DisputeActionInput): Promise<Result<{ message?: string }>> {
  if (!(await trustReady(admin))) return { error: 'Bu özellik henüz açılmadı.' }
  const now = new Date().toISOString()
  const isBrand = collab.brand_id === userId
  const link = collabLink(collab.id)
  const name = await displayNameOf(admin, userId)

  if (input.action === 'report_nondelivery') {
    if (!isBrand) return { error: 'Bu işlem şu an yapılamaz.' }
    if (collab.status === 'cancelled') return { error: 'İptal edilen iş birliğinde bildirim yapılamaz.' }
    if (!isUuid(input.deliverableId)) return { error: 'Teslimat bulunamadı.' }
    const { data: d } = await admin
      .from('collaboration_deliverables')
      .select('id, kind, quantity, due_date, status')
      .eq('id', input.deliverableId)
      .eq('collaboration_id', collab.id)
      .maybeSingle()
    if (!d) return { error: 'Teslimat bulunamadı.' }
    const availableAt = nondeliveryAvailableAt(d as { due_date: string | null; status: string })
    if (!availableAt || Date.now() < new Date(availableAt).getTime()) {
      return { error: 'Bu bildirim, teslim tarihinden birkaç gün sonra ve teslimat onaylanmamışsa açılır.' }
    }
    const label = `${DELIVERABLE_KIND_LABELS[d.kind as DeliverableKind] ?? 'Teslimat'}${(d.quantity as number) > 1 ? ` ×${d.quantity}` : ''}`
    const opened = await openDispute(admin, {
      collaborationId: collab.id,
      title: collab.title,
      kind: 'nondelivery',
      reporterId: userId,
      respondentId: collab.influencer_id,
      deliverableId: d.id as string,
      deliverableLabel: label,
      note: cleanText(input.note, 500) || null,
    })
    if (!opened) return { error: 'Bu teslimat için zaten açık bir bildirim var ya da bildirim kaydedilemedi.' }
    return { success: true, message: `Bildirim influencer'a iletildi. ${DISPUTE_RESPONSE_DAYS} gün içinde yanıt vermesi gerekiyor.` }
  }

  const dispute = await loadDispute(admin, collab.id, input.disputeId)
  if (!dispute || (dispute.reporter_id !== userId && dispute.respondent_id !== userId)) return { error: 'Bildirim bulunamadı.' }
  const allowed = actionsFor(dispute, userId)

  switch (input.action) {
    case 'dispute_respond': {
      if (!allowed.includes('respond')) return { error: 'Bu bildirime artık yanıt verilemez.' }
      const note = cleanText(input.note, DISPUTE_NOTE_MAX)
      let proofPath: string | null = null
      if (input.proofPath) {
        if (!isOwnProofPath(userId, dispute.id, input.proofPath) || !(await proofExists(admin, input.proofPath))) {
          return { error: 'Dosya bulunamadı. Lütfen yeniden yükleyin.' }
        }
        proofPath = input.proofPath
      }
      if (!proofPath && note.length < 10) return { error: 'Dekont / kanıt yükleyin ya da durumu en az 10 karakterle açıklayın.' }
      const patch: Record<string, unknown> = { response_note: note || dispute.response_note, responded_at: now, updated_at: now }
      if (proofPath) Object.assign(patch, { proof_path: proofPath, proof_uploaded_at: now })
      // İncelemedeyken gelen yanıt kayda eklenir; durum değişmez (karar admin'in).
      if (dispute.status === 'open') patch.status = 'responded'
      const { data, error } = await admin.from('collaboration_disputes').update(patch).eq('id', dispute.id).in('status', ACTIVE_DISPUTE_STATUSES).select('id')
      if (error || !data?.length) return { error: 'Kaydedilemedi. Sayfayı yenileyip tekrar deneyin.' }
      await notifyUser(
        {
          userId: dispute.reporter_id,
          event: 'collab_dispute',
          title: 'Bildirimine yanıt verildi',
          message: `${name}, "${collab.title}" iş birliğindeki ${DISPUTE_KIND_LABELS[dispute.kind].toLocaleLowerCase('tr-TR')} bildirimine yanıt verdi${proofPath ? ' ve kanıt yükledi' : ''}. Sorun çözüldüyse teyit et; çözülmediyse destek ekibine taşıyabilirsin.`,
          link,
        },
        admin,
      )
      return { success: true, message: 'Yanıtın kaydedildi ve karşı tarafa iletildi.' }
    }

    case 'dispute_mark_resolved': {
      if (!allowed.includes('mark_resolved')) return { error: 'Bu işlem şu an yapılamaz.' }
      const note = cleanText(input.note, DISPUTE_NOTE_MAX) || dispute.response_note
      const patch: Record<string, unknown> = { respondent_resolved_at: now, response_note: note, updated_at: now }
      if (dispute.status === 'open') Object.assign(patch, { status: 'responded', responded_at: dispute.responded_at ?? now })
      const { data, error } = await admin.from('collaboration_disputes').update(patch).eq('id', dispute.id).in('status', ACTIVE_DISPUTE_STATUSES).select('id')
      if (error || !data?.length) return { error: 'Kaydedilemedi. Sayfayı yenileyip tekrar deneyin.' }
      // Ödeme bildiriminde "çözüldü" = marka ödediğini söylüyor: ödeme işareti yoksa eklenir.
      if (dispute.kind === 'nonpayment') {
        await admin
          .from('collaboration_payments')
          .update({ brand_paid_at: now, brand_paid_date: now.slice(0, 10), updated_at: now })
          .eq('collaboration_id', collab.id)
          .is('brand_paid_at', null)
      }
      await notifyUser(
        {
          userId: dispute.reporter_id,
          event: 'collab_dispute',
          title: 'Karşı taraf sorunun çözüldüğünü bildirdi',
          message: `${name}, "${collab.title}" iş birliğindeki bildirimin çözüldüğünü söylüyor. Doğruysa iş birliği sayfasından "Çözüldü" ile teyit et.`,
          link,
        },
        admin,
      )
      return { success: true, message: 'Kaydedildi. Karşı tarafın teyidi bekleniyor.' }
    }

    case 'dispute_confirm_resolved': {
      if (!allowed.includes('confirm_resolved')) return { error: 'Bu işlem şu an yapılamaz.' }
      const { data, error } = await admin
        .from('collaboration_disputes')
        .update({ status: 'resolved', reporter_confirmed_at: now, updated_at: now })
        .eq('id', dispute.id)
        .in('status', ACTIVE_DISPUTE_STATUSES)
        .select('id')
      if (error || !data?.length) return { error: 'Kaydedilemedi. Sayfayı yenileyip tekrar deneyin.' }
      await releaseHolds(admin, dispute.id, userId)
      if (dispute.kind === 'nonpayment') {
        // Influencer ödemeyi aldığını teyit etmiş sayılır.
        await admin
          .from('collaboration_payments')
          .update({ influencer_received_at: now, influencer_received_date: now.slice(0, 10), updated_at: now })
          .eq('collaboration_id', collab.id)
          .is('influencer_received_at', null)
      }
      await notifyUser(
        {
          userId: dispute.respondent_id,
          event: 'collab_dispute',
          title: 'Bildirim çözüldü olarak kapandı',
          message: `${name}, "${collab.title}" iş birliğindeki bildirimin çözüldüğünü teyit etti.${dispute.status === 'escalated' ? ' Hesabındaki inceleme kısıtı kaldırıldı.' : ''}`,
          link,
          type: 'success',
        },
        admin,
      )
      return { success: true, message: 'Bildirim çözüldü olarak kapandı.' }
    }

    case 'dispute_escalate': {
      if (!allowed.includes('escalate')) return { error: 'Bu işlem şu an yapılamaz.' }
      const note = cleanText(input.note, 500)
      const { data, error } = await admin
        .from('collaboration_disputes')
        .update({
          status: 'escalated',
          escalated_at: now,
          reporter_note: note ? `${dispute.reporter_note ? `${dispute.reporter_note}\n` : ''}Destek ekibine taşındı: ${note}`.slice(0, 500) : dispute.reporter_note,
          updated_at: now,
        })
        .eq('id', dispute.id)
        .eq('status', 'responded')
        .select('id')
      if (error || !data?.length) return { error: 'Kaydedilemedi. Sayfayı yenileyip tekrar deneyin.' }
      await notifyUser(
        {
          userId: dispute.respondent_id,
          event: 'collab_dispute',
          title: 'Bildirim destek ekibine taşındı',
          message: `${name}, "${collab.title}" iş birliğindeki bildirimi destek ekibine taşıdı. Ekip iki tarafın kayıtlarını inceleyecek.`,
          link,
          type: 'warning',
        },
        admin,
      )
      return { success: true, message: 'Bildirim destek ekibine taşındı.' }
    }

    default:
      return { error: 'Geçersiz işlem.' }
  }
}

/** Kanıt dosyası için imzalı yükleme adresi (yalnızca anlaşmazlığın karşı tarafı, aktif kayıtta). Günde en fazla 10 dosya. */
export async function createProofUploadUrlAs(
  userId: string,
  collaborationId: string,
  disputeId: unknown,
  extensionInput: unknown,
): Promise<Result<{ path: string; token: string; bucket: string }>> {
  const admin = createSupabaseAdminClient()
  if (!admin || !(await trustReady(admin))) return { error: 'Bu özellik henüz açılmadı.' }
  if (!isUuid(collaborationId)) return { error: 'İş birliği bulunamadı.' }
  const dispute = await loadDispute(admin, collaborationId, disputeId)
  if (!dispute || dispute.respondent_id !== userId || !ACTIVE_DISPUTE_STATUSES.includes(dispute.status)) return { error: 'Bildirim bulunamadı.' }
  const ext = proofExtension(extensionInput)
  if (!ext) return { error: 'Yalnızca PDF, JPG, PNG ya da WEBP yüklenebilir.' }
  const { data: existing } = await admin.storage.from(DISPUTE_PROOF_BUCKET).list(`${userId}/${dispute.id}`, { limit: 20 })
  if ((existing ?? []).length >= 10) return { error: 'Bu bildirim için en fazla 10 dosya yüklenebilir.' }
  const path = `${userId}/${dispute.id}/${Date.now()}.${ext}`
  const { data, error } = await admin.storage.from(DISPUTE_PROOF_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { error: 'Yükleme adresi oluşturulamadı.' }
  return { success: true, path, token: data.token, bucket: DISPUTE_PROOF_BUCKET }
}

/** Kanıt dosyasını 10 dakikalık bağlantıyla açar: yalnızca anlaşmazlığın tarafları ve admin. */
export async function proofUrlFor(viewerId: string, disputeId: unknown, opts: { isAdmin?: boolean } = {}): Promise<Result<{ url: string }>> {
  const admin = createSupabaseAdminClient()
  if (!admin || !isUuid(disputeId)) return { error: 'Dosya bulunamadı.' }
  const { data } = await admin.from('collaboration_disputes').select('reporter_id, respondent_id, proof_path').eq('id', disputeId).maybeSingle()
  if (!data?.proof_path) return { error: 'Dosya bulunamadı.' }
  if (!opts.isAdmin && data.reporter_id !== viewerId && data.respondent_id !== viewerId) return { error: 'Dosya bulunamadı.' }
  const { data: signed, error } = await admin.storage.from(DISPUTE_PROOF_BUCKET).createSignedUrl(data.proof_path as string, 600)
  if (error || !signed) return { error: 'Bağlantı oluşturulamadı.' }
  return { success: true, url: signed.signedUrl }
}

// --- Saatlik görev ---------------------------------------------------------------------------------

/** Süresi dolan ve yanıtsız anlaşmazlıklar "İncelemede" olur; karşı tarafın hesabına inceleme kısıtı konur. */
export async function escalateOverdueDisputes(admin: SupabaseClient, opts: { limit?: number; deadline?: number } = {}) {
  const summary = { escalated: 0, skipped: false as boolean | string }
  if (!(await trustReady(admin))) {
    summary.skipped = 'tables_missing'
    return summary
  }
  const { data, error } = await admin
    .from('collaboration_disputes')
    .select(DISPUTE_COLUMNS)
    .eq('status', 'open')
    .lt('response_due_at', new Date().toISOString())
    .order('response_due_at')
    .limit(opts.limit ?? 25)
  if (error) throw new Error(`anlaşmazlıklar okunamadı: ${error.message}`)
  for (const d of (data ?? []) as DisputeRow[]) {
    if (opts.deadline && Date.now() > opts.deadline) break
    const now = new Date().toISOString()
    const { data: moved } = await admin
      .from('collaboration_disputes')
      .update({ status: 'escalated', escalated_at: now, updated_at: now })
      .eq('id', d.id)
      .eq('status', 'open')
      .select('id')
    if (!moved?.length) continue
    const { error: holdError } = await admin
      .from('account_holds')
      .insert({ user_id: d.respondent_id, kind: 'review', dispute_id: d.id, reason: `${DISPUTE_KIND_LABELS[d.kind]} bildirimine ${DISPUTE_RESPONSE_DAYS} gün içinde yanıt verilmedi.` })
    if (holdError && holdError.code !== '23505') console.error('[disputes] kısıt eklenemedi:', holdError.message)
    const { data: collab } = await admin.from('collaborations').select('title').eq('id', d.collaboration_id).maybeSingle()
    const title = (collab?.title as string | undefined) ?? 'İş birliği'
    await notifyUser(
      {
        userId: d.respondent_id,
        event: 'account_hold',
        title: 'Hesabın incelemeye alındı',
        message: `"${title}" iş birliğindeki ${DISPUTE_KIND_LABELS[d.kind].toLocaleLowerCase('tr-TR')} bildirimine ${DISPUTE_RESPONSE_DAYS} gün içinde yanıt verilmedi. İnceleme bitene kadar yeni ilan, teklif ve başvuru yapamazsın. Kanıtın varsa iş birliği sayfasından hâlâ yükleyebilirsin; son kararı destek ekibi verir.`,
        link: collabLink(d.collaboration_id),
        type: 'warning',
      },
      admin,
    )
    await notifyUser(
      {
        userId: d.reporter_id,
        event: 'collab_dispute',
        title: 'Bildirimin destek ekibine taşındı',
        message: `"${title}" iş birliğindeki bildirimine ${DISPUTE_RESPONSE_DAYS} gün içinde yanıt verilmedi. Karşı tarafın hesabı incelemeye alındı; destek ekibi kayıtları inceleyip karar verecek.`,
        link: collabLink(d.collaboration_id),
      },
      admin,
    )
    summary.escalated++
  }
  return summary
}

// --- Admin ---------------------------------------------------------------------------------------------

export interface AdminDisputeView {
  id: string
  kind: DisputeKind
  kindLabel: string
  status: DisputeStatus
  statusLabel: string
  collaboration: { id: string; title: string; status: string; completedAt: string | null }
  reporter: { id: string; name: string; username: string | null; role: string | null }
  respondent: { id: string; name: string; username: string | null; role: string | null }
  deliverable: { label: string; dueDate: string | null; status: string } | null
  agreement: { fee: string; paymentDueDate: string | null } | null
  payment: { brandPaidDate: string | null; influencerReceivedDate: string | null } | null
  reporterNote: string | null
  responseNote: string | null
  hasProof: boolean
  responseDueAt: string
  supportTicketId: string | null
  activeHold: 'review' | 'suspended' | null
  timeline: Array<{ at: string; text: string }>
}

export interface AdminDisputesResult {
  available: boolean
  disputes: AdminDisputeView[]
  counts: Record<'active' | 'escalated' | 'closed', number>
}

export async function countEscalatedDisputes(admin: SupabaseClient | null): Promise<number> {
  if (!admin || !(await trustReady(admin))) return 0
  const { count } = await admin.from('collaboration_disputes').select('id', { count: 'exact', head: true }).eq('status', 'escalated')
  return count ?? 0
}

export async function loadAdminDisputes(admin: SupabaseClient, filter: 'escalated' | 'active' | 'closed' | 'all' = 'escalated'): Promise<AdminDisputesResult> {
  const counts = { active: 0, escalated: 0, closed: 0 }
  if (!(await trustReady(admin))) return { available: false, disputes: [], counts }
  const { data: statusRows } = await admin.from('collaboration_disputes').select('status').limit(10000)
  for (const r of (statusRows ?? []) as Array<{ status: DisputeStatus }>) {
    if (r.status === 'escalated') counts.escalated++
    else if (r.status === 'open' || r.status === 'responded') counts.active++
    else counts.closed++
  }
  let query = admin.from('collaboration_disputes').select(DISPUTE_COLUMNS)
  if (filter === 'escalated') query = query.eq('status', 'escalated')
  else if (filter === 'active') query = query.in('status', ['open', 'responded'])
  else if (filter === 'closed') query = query.in('status', ['resolved', 'upheld', 'dismissed', 'paid'])
  const { data, error } = await query.order('created_at', { ascending: filter === 'escalated' }).limit(200)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as DisputeRow[]
  if (!rows.length) return { available: true, disputes: [], counts }

  const collabIds = Array.from(new Set(rows.map((r) => r.collaboration_id)))
  const userIds = Array.from(new Set(rows.flatMap((r) => [r.reporter_id, r.respondent_id])))
  const deliverableIds = rows.map((r) => r.deliverable_id).filter((v): v is string => !!v)
  const [{ data: collabs }, { data: users }, { data: agreements }, { data: payments }, { data: deliverables }, { data: holds }, { data: reminders }] = await Promise.all([
    admin.from('collaborations').select('id, title, status, completed_at').in('id', collabIds),
    admin.from('users').select('id, full_name, username, role').in('id', userIds),
    admin.from('collaboration_agreements').select('collaboration_id, fee_amount, payment_type, payment_due_date').in('collaboration_id', collabIds),
    admin.from('collaboration_payments').select('collaboration_id, brand_paid_date, influencer_received_date').in('collaboration_id', collabIds),
    deliverableIds.length ? admin.from('collaboration_deliverables').select('id, kind, quantity, due_date, status').in('id', deliverableIds) : Promise.resolve({ data: [] }),
    admin.from('account_holds').select('dispute_id, kind').in('dispute_id', rows.map((r) => r.id)).is('released_at', null),
    admin.from('collaboration_reminders').select('collaboration_id, kind, step, sent_at').in('collaboration_id', collabIds),
  ])
  const collabOf = new Map(((collabs ?? []) as Array<{ id: string; title: string; status: string; completed_at: string | null }>).map((c) => [c.id, c]))
  const userOf = new Map(((users ?? []) as Array<{ id: string; full_name: string | null; username: string | null; role: string | null }>).map((u) => [u.id, u]))
  const agreementOf = new Map(((agreements ?? []) as Array<{ collaboration_id: string; fee_amount: number | null; payment_type: string; payment_due_date: string | null }>).map((a) => [a.collaboration_id, a]))
  const paymentOf = new Map(((payments ?? []) as Array<{ collaboration_id: string; brand_paid_date: string | null; influencer_received_date: string | null }>).map((p) => [p.collaboration_id, p]))
  const deliverableOf = new Map(((deliverables ?? []) as Array<{ id: string; kind: DeliverableKind; quantity: number; due_date: string | null; status: string }>).map((d) => [d.id, d]))
  const holdOf = new Map<string, 'review' | 'suspended'>()
  for (const h of (holds ?? []) as Array<{ dispute_id: string; kind: 'review' | 'suspended' }>) {
    if (h.kind === 'suspended' || !holdOf.has(h.dispute_id)) holdOf.set(h.dispute_id, h.kind)
  }
  const person = (id: string) => {
    const u = userOf.get(id)
    return { id, name: u?.full_name || (u?.username ? `@${u.username}` : 'Silinmiş kullanıcı'), username: u?.username ?? null, role: u?.role ?? null }
  }

  const disputes = rows.map((d): AdminDisputeView => {
    const c = collabOf.get(d.collaboration_id)
    const a = agreementOf.get(d.collaboration_id)
    const p = paymentOf.get(d.collaboration_id)
    const dl = d.deliverable_id ? deliverableOf.get(d.deliverable_id) : null
    const timeline: Array<{ at: string; text: string }> = [{ at: d.created_at, text: `${DISPUTE_KIND_LABELS[d.kind]} bildirildi (${person(d.reporter_id).name})` }]
    if (d.responded_at) timeline.push({ at: d.responded_at, text: 'Karşı taraf yanıt verdi' })
    if (d.proof_uploaded_at) timeline.push({ at: d.proof_uploaded_at, text: 'Kanıt yüklendi' })
    if (d.respondent_resolved_at) timeline.push({ at: d.respondent_resolved_at, text: 'Karşı taraf "çözüldü" dedi' })
    if (d.escalated_at) timeline.push({ at: d.escalated_at, text: 'İncelemeye alındı' })
    if (d.reporter_confirmed_at) timeline.push({ at: d.reporter_confirmed_at, text: 'Bildiren taraf çözüldüğünü teyit etti' })
    if (d.decided_at) timeline.push({ at: d.decided_at, text: `Admin kararı: ${DISPUTE_STATUS_LABELS[d.status]}` })
    for (const r of ((reminders ?? []) as Array<{ collaboration_id: string; kind: string; step: number; sent_at: string }>).filter((r) => r.collaboration_id === d.collaboration_id)) {
      timeline.push({ at: r.sent_at, text: r.kind === 'payment_brand' ? `Markaya ödeme hatırlatması (${r.step}. gün)` : `Influencer'a teyit hatırlatması (${r.step}. gün)` })
    }
    timeline.sort((x, y) => x.at.localeCompare(y.at))
    return {
      id: d.id,
      kind: d.kind,
      kindLabel: DISPUTE_KIND_LABELS[d.kind],
      status: d.status,
      statusLabel: DISPUTE_STATUS_LABELS[d.status],
      collaboration: { id: d.collaboration_id, title: c?.title ?? 'İş birliği', status: c?.status ?? '—', completedAt: c?.completed_at ?? null },
      reporter: person(d.reporter_id),
      respondent: person(d.respondent_id),
      deliverable: dl ? { label: `${DELIVERABLE_KIND_LABELS[dl.kind] ?? 'Teslimat'}${dl.quantity > 1 ? ` ×${dl.quantity}` : ''}`, dueDate: dl.due_date, status: dl.status } : null,
      agreement: a ? { fee: `${formatTry(a.fee_amount)} · ${a.payment_type === 'barter' ? 'Barter' : 'Nakit'}`, paymentDueDate: a.payment_due_date } : null,
      payment: p ? { brandPaidDate: p.brand_paid_date, influencerReceivedDate: p.influencer_received_date } : null,
      reporterNote: d.reporter_note,
      responseNote: d.response_note,
      hasProof: !!d.proof_path,
      responseDueAt: d.response_due_at,
      supportTicketId: d.support_ticket_id,
      activeHold: holdOf.get(d.id) ?? null,
      timeline,
    }
  })
  return { available: true, disputes, counts }
}

export type AdminDisputeDecision = 'suspend' | 'dismiss' | 'mark_paid'

/** Hook: anlaşmazlık haklı bulununca (askıya alma) çağrılır; Influcash geri alımı gibi yan etkiler buraya bağlanır. */
export type UpheldHook = (admin: SupabaseClient, dispute: DisputeRow) => Promise<void>
const upheldHooks: UpheldHook[] = []
export function onDisputeUpheld(hook: UpheldHook) {
  upheldHooks.push(hook)
}

/**
 * Admin kararı. suspend: karşı tarafın hesabı askıya alınır (karar kaydı + itiraz hakkı; neden zorunlu), anlaşmazlık "upheld".
 * dismiss: kapatılır, kısıt kalkar. mark_paid (yalnızca ödeme): ödendi olarak kapanır, ödeme işaretleri tamamlanır, kısıt kalkar.
 * İki tarafa bildirim gider. Yalnızca aktif (açık / yanıtlı / incelemede) kayıtta.
 */
export async function decideDisputeAsAdmin(
  admin: SupabaseClient,
  adminUserId: string,
  disputeId: unknown,
  decision: AdminDisputeDecision,
  input: { reason?: DecisionReasonInput | null; note?: unknown },
): Promise<Result<{ message: string }>> {
  if (!isUuid(disputeId)) return { error: 'Anlaşmazlık bulunamadı.' }
  if (!['suspend', 'dismiss', 'mark_paid'].includes(decision)) return { error: 'Geçersiz karar.' }
  const { data } = await admin.from('collaboration_disputes').select(DISPUTE_COLUMNS).eq('id', disputeId).maybeSingle()
  const dispute = data as DisputeRow | null
  if (!dispute) return { error: 'Anlaşmazlık bulunamadı.' }
  if (!ACTIVE_DISPUTE_STATUSES.includes(dispute.status)) return { error: 'Bu anlaşmazlık zaten kapanmış.' }
  if (decision === 'mark_paid' && dispute.kind !== 'nonpayment') return { error: '"Ödendi" yalnızca ödeme bildiriminde kullanılır.' }

  let note = cleanText(input.note, 1000)
  let reason: ReturnType<typeof parseDecisionReason> | null = null
  if (decision === 'suspend') {
    reason = parseDecisionReason('collaboration_dispute', input.reason ?? null)
    if (!reason.ok) return { error: reason.error }
    note = formatReason(reason.reason)
  } else if (note.length < 3) {
    return { error: 'Kararın kısa açıklamasını yazın (iki tarafa gösterilir).' }
  }

  const now = new Date().toISOString()
  const status: DisputeStatus = decision === 'suspend' ? 'upheld' : decision === 'dismiss' ? 'dismissed' : 'paid'
  const { data: moved, error } = await admin
    .from('collaboration_disputes')
    .update({ status, decided_at: now, decided_by: adminUserId, decision_note: note, updated_at: now })
    .eq('id', dispute.id)
    .in('status', ACTIVE_DISPUTE_STATUSES)
    .select('id')
  if (error) return { error: `Karar kaydedilemedi: ${error.message}` }
  if (!moved?.length) return { error: 'Bu anlaşmazlık zaten karara bağlanmış.' }

  await releaseHolds(admin, dispute.id, adminUserId)
  const { data: collab } = await admin.from('collaborations').select('title').eq('id', dispute.collaboration_id).maybeSingle()
  const title = (collab?.title as string | undefined) ?? 'İş birliği'
  const link = collabLink(dispute.collaboration_id)

  if (decision === 'suspend' && reason?.ok) {
    const { error: holdError } = await admin
      .from('account_holds')
      .insert({ user_id: dispute.respondent_id, kind: 'suspended', dispute_id: dispute.id, reason: note.slice(0, 500), created_by: adminUserId })
    if (holdError && holdError.code !== '23505') {
      // Kısıt yazılamadıysa karar geri alınır: askıya alınmamış "upheld" kayıt kalmasın.
      await admin.from('collaboration_disputes').update({ status: dispute.status, decided_at: null, decided_by: null, decision_note: null }).eq('id', dispute.id)
      return { error: `Askıya alma kaydedilemedi: ${holdError.message}` }
    }
    await recordDecision(admin, {
      subjectType: 'collaboration_dispute',
      subjectId: dispute.id,
      userId: dispute.respondent_id,
      reason: reason.reason,
      decidedBy: adminUserId,
      decision: 'suspended',
    })
    for (const hook of upheldHooks) {
      try {
        await hook(admin, { ...dispute, status: 'upheld' })
      } catch (hookError) {
        console.error('[disputes] karar sonrası işlem:', hookError)
      }
    }
  }
  if (decision === 'mark_paid') {
    await admin.from('collaboration_payments').upsert({ collaboration_id: dispute.collaboration_id }, { onConflict: 'collaboration_id', ignoreDuplicates: true })
    await admin.from('collaboration_payments').update({ brand_paid_at: now, brand_paid_date: now.slice(0, 10) }).eq('collaboration_id', dispute.collaboration_id).is('brand_paid_at', null)
    await admin
      .from('collaboration_payments')
      .update({ influencer_received_at: now, influencer_received_date: now.slice(0, 10) })
      .eq('collaboration_id', dispute.collaboration_id)
      .is('influencer_received_at', null)
  }

  const respondentText: Record<AdminDisputeDecision, string> = {
    suspend: `"${title}" iş birliğindeki ${DISPUTE_KIND_LABELS[dispute.kind].toLocaleLowerCase('tr-TR')} bildirimi incelendi ve hesabın askıya alındı. Neden: ${note}. Yeni ilan, teklif ve başvuru yapamazsın. Karara bir kez itiraz edebilirsin.`,
    dismiss: `"${title}" iş birliğindeki bildirim incelendi ve kapatıldı. Not: ${note}`,
    mark_paid: `"${title}" iş birliğindeki ödeme bildirimi ödendi olarak kapatıldı. Not: ${note}`,
  }
  const reporterText: Record<AdminDisputeDecision, string> = {
    suspend: `"${title}" iş birliğindeki bildirimin incelendi; karşı tarafın hesabı askıya alındı. İş birliği kayıtlarını iş birliği sayfasından indirebilirsin.`,
    dismiss: `"${title}" iş birliğindeki bildirimin incelendi ve kapatıldı. Not: ${note}`,
    mark_paid: `"${title}" iş birliğindeki ödeme bildirimi ödendi olarak kapatıldı. Not: ${note}`,
  }
  await notifyUser(
    {
      userId: dispute.respondent_id,
      event: decision === 'suspend' ? 'account_hold' : 'collab_dispute',
      title: decision === 'suspend' ? 'Hesabın askıya alındı' : 'Bildirim kapatıldı',
      message: respondentText[decision],
      link: decision === 'suspend' ? '/dashboard' : link,
      type: decision === 'suspend' ? 'warning' : 'info',
    },
    admin,
  )
  await notifyUser({ userId: dispute.reporter_id, event: 'collab_dispute', title: 'Bildirimin sonuçlandı', message: reporterText[decision], link }, admin)
  return { success: true, message: decision === 'suspend' ? 'Hesap askıya alındı; iki tarafa bildirildi.' : 'Karar kaydedildi; iki tarafa bildirildi.' }
}

/** Kullanıcının kendi hesabındaki aktif kısıtların açıklaması (panel bandı ve mobil). */
export async function holdNoticeFor(userId: string, admin: SupabaseClient | null = createSupabaseAdminClient()) {
  if (!admin || !(await trustReady(admin))) return null
  const { data } = await admin.from('account_holds').select('kind, reason, created_at').eq('user_id', userId).is('released_at', null).order('created_at', { ascending: false }).limit(5)
  const rows = (data ?? []) as Array<{ kind: 'review' | 'suspended'; reason: string | null; created_at: string }>
  if (!rows.length) return null
  const suspended = rows.find((r) => r.kind === 'suspended')
  return { kind: suspended ? ('suspended' as const) : ('review' as const), reason: (suspended ?? rows[0]).reason, since: (suspended ?? rows[0]).created_at }
}
