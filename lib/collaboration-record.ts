// İş birliği kaydı (2026-11-23; SYSTEM_MAP 15): anlaşma, teslimatlar + tarihler, taslak geçmişi, ödeme işaretleri, önemli sistem
// olayları, anlaşmazlıklar ve iş birliğinin sohbet odasındaki mesajlar. Sunucuda üretilen yazdırılabilir HTML (tarayıcıdan PDF);
// yeni bağımlılık yok. Yalnızca iş birliğinin tarafları ve admin indirebilir; her indirme erişim günlüğüne yazılır.
//
// Mobil uygulama çerez taşımadığı için /api/mobile/collaborations/[id]/record kısa süreli (10 dk) imzalı bir bağlantı üretir;
// bağlantı yalnızca o kullanıcı + iş birliği için geçerlidir ve sunucuda yine taraf kontrolü yapılır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { createHmac, timingSafeEqual } from 'crypto'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { logPrivacyAccess } from '@/lib/privacy-audit'
import { trustReady } from '@/lib/collaboration-trust'
import { COLLABORATION_STATUS_LABELS, type CollaborationStatus } from '@/lib/collaboration-shared'
import { COMMITMENT_TEXT, DISPUTE_KIND_LABELS, DISPUTE_STATUS_LABELS, type DisputeKind, type DisputeStatus } from '@/lib/collaboration-trust-shared'
import {
  DELIVERABLE_KIND_LABELS,
  DELIVERABLE_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  formatTry,
  type AgreementPaymentType,
  type DeliverableKind,
  type DeliverableStatus,
} from '@/lib/collaboration-workspace-shared'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MESSAGE_LIMIT = 2000
const TOKEN_TTL_MS = 10 * 60 * 1000

interface Person {
  id: string
  name: string
  username: string | null
  role: string | null
}

export interface CollaborationRecord {
  generatedAt: string
  generatedFor: string
  collaboration: {
    id: string
    title: string
    status: string
    source: string
    createdAt: string
    publishedAt: string | null
    completedAt: string | null
    autoCompleted: boolean
    cancelledAt: string | null
    cancelReason: string | null
    publishUrl: string | null
  }
  brand: Person
  influencer: Person
  agreement: {
    fee: string
    paymentType: string
    paymentDueDate: string | null
    usageRights: string | null
    revisionLimit: number
    version: number
    brandConfirmedAt: string | null
    influencerConfirmedAt: string | null
  } | null
  deliverables: Array<{
    id: string
    label: string
    note: string | null
    dueDate: string | null
    status: string
    revisionsUsed: number
    draftSubmittedAt: string | null
    approvedAt: string | null
    publishUrl: string | null
    publishedAt: string | null
    submissions: Array<{ at: string; url: string | null; note: string | null; review: string | null; reviewNote: string | null; reviewedAt: string | null }>
  }>
  payment: {
    brandPaidAt: string | null
    brandPaidDate: string | null
    brandNote: string | null
    influencerReceivedAt: string | null
    influencerReceivedDate: string | null
    influencerNote: string | null
    nonpaymentReportedAt: string | null
  } | null
  commitmentAcceptedAt: string | null
  disputes: Array<{ kind: string; status: string; openedAt: string; reporterNote: string | null; responseNote: string | null; hasProof: boolean; decidedAt: string | null; decisionNote: string | null }>
  reminders: Array<{ kind: string; step: number; sentAt: string }>
  messages: Array<{ at: string; sender: string; text: string; system: boolean }>
  messagesTruncated: boolean
}

/**
 * Kaydı üretir. viewerId iş birliğinin tarafı değilse ve admin değilse null döner ("bulunamadı").
 * Okumalar service role ile; taraf kontrolü burada.
 */
export async function buildCollaborationRecord(collaborationId: string, viewerId: string): Promise<CollaborationRecord | null> {
  const admin = createSupabaseAdminClient()
  if (!admin || !UUID_RE.test(collaborationId) || !UUID_RE.test(viewerId)) return null

  const [{ data: collab }, { data: viewer }] = await Promise.all([
    admin
      .from('collaborations')
      .select('id, brand_id, influencer_id, source, title, status, publish_url, published_at, completed_at, auto_completed, cancelled_at, cancel_reason, room_id, created_at')
      .eq('id', collaborationId)
      .maybeSingle(),
    admin.from('users').select('role').eq('id', viewerId).maybeSingle(),
  ])
  if (!collab) return null
  const isAdmin = viewer?.role === 'admin'
  if (!isAdmin && collab.brand_id !== viewerId && collab.influencer_id !== viewerId) return null

  const ready = await trustReady(admin)
  const agreementColumns = `fee_amount, payment_type, usage_rights, revision_limit, version, brand_confirmed_at, influencer_confirmed_at${ready ? ', payment_due_date' : ''}`
  const [{ data: users }, { data: agreement }, { data: deliverables }, { data: submissions }, { data: payment }] = await Promise.all([
    admin.from('users').select('id, full_name, username, role').in('id', [collab.brand_id, collab.influencer_id]),
    admin.from('collaboration_agreements').select(agreementColumns).eq('collaboration_id', collab.id).maybeSingle(),
    admin
      .from('collaboration_deliverables')
      .select('id, kind, quantity, note, due_date, status, revisions_used, draft_submitted_at, approved_at, publish_url, published_at, position, created_at')
      .eq('collaboration_id', collab.id)
      .order('position')
      .order('created_at'),
    admin
      .from('collaboration_submissions')
      .select('deliverable_id, url, note, review, review_note, reviewed_at, created_at')
      .eq('collaboration_id', collab.id)
      .order('created_at')
      .limit(1000),
    admin
      .from('collaboration_payments')
      .select('brand_paid_at, brand_paid_date, brand_note, influencer_received_at, influencer_received_date, influencer_note, nonpayment_reported_at')
      .eq('collaboration_id', collab.id)
      .maybeSingle(),
  ])

  const people = new Map(((users ?? []) as Array<{ id: string; full_name: string | null; username: string | null; role: string | null }>).map((u) => [u.id, u]))
  const person = (id: string): Person => {
    const u = people.get(id)
    return { id, name: u?.full_name || (u?.username ? `@${u.username}` : 'Silinmiş kullanıcı'), username: u?.username ?? null, role: u?.role ?? null }
  }

  // Sohbet: yalnızca iş birliğinin kendi odası (teklif ya da başvuru odası).
  let messages: CollaborationRecord['messages'] = []
  let messagesTruncated = false
  if (collab.room_id) {
    const { data: rows } = await admin
      .from('messages')
      .select('sender_id, content, created_at, is_system')
      .eq('room_id', collab.room_id)
      .order('created_at')
      .limit(MESSAGE_LIMIT + 1)
    const list = (rows ?? []) as Array<{ sender_id: string | null; content: string; created_at: string; is_system?: boolean | null }>
    messagesTruncated = list.length > MESSAGE_LIMIT
    messages = list.slice(0, MESSAGE_LIMIT).map((m) => ({
      at: m.created_at,
      sender: m.is_system ? 'Sistem' : m.sender_id ? person(m.sender_id).name : '—',
      text: m.content,
      system: !!m.is_system,
    }))
  }

  let disputes: CollaborationRecord['disputes'] = []
  let reminders: CollaborationRecord['reminders'] = []
  let commitmentAcceptedAt: string | null = null
  if (ready) {
    const [{ data: d }, { data: r }, { data: c }] = await Promise.all([
      admin
        .from('collaboration_disputes')
        .select('kind, status, created_at, reporter_note, response_note, proof_path, decided_at, decision_note')
        .eq('collaboration_id', collab.id)
        .order('created_at'),
      admin.from('collaboration_reminders').select('kind, step, sent_at').eq('collaboration_id', collab.id).order('sent_at'),
      admin.from('collaboration_commitments').select('accepted_at').eq('user_id', collab.brand_id).order('accepted_at').limit(1).maybeSingle(),
    ])
    disputes = ((d ?? []) as Array<{ kind: DisputeKind; status: DisputeStatus; created_at: string; reporter_note: string | null; response_note: string | null; proof_path: string | null; decided_at: string | null; decision_note: string | null }>).map((x) => ({
      kind: DISPUTE_KIND_LABELS[x.kind] ?? x.kind,
      status: DISPUTE_STATUS_LABELS[x.status] ?? x.status,
      openedAt: x.created_at,
      reporterNote: x.reporter_note,
      responseNote: x.response_note,
      hasProof: !!x.proof_path,
      decidedAt: x.decided_at,
      decisionNote: x.decision_note,
    }))
    reminders = ((r ?? []) as Array<{ kind: string; step: number; sent_at: string }>).map((x) => ({
      kind: x.kind === 'payment_brand' ? 'Markaya ödeme hatırlatması' : "Influencer'a teyit hatırlatması",
      step: x.step,
      sentAt: x.sent_at,
    }))
    commitmentAcceptedAt = (c?.accepted_at as string | undefined) ?? null
  }

  const a = agreement as unknown as {
    fee_amount: number | null
    payment_type: AgreementPaymentType
    usage_rights: string | null
    revision_limit: number
    version: number
    brand_confirmed_at: string | null
    influencer_confirmed_at: string | null
    payment_due_date?: string | null
  } | null
  const subs = (submissions ?? []) as Array<{ deliverable_id: string; url: string | null; note: string | null; review: string | null; review_note: string | null; reviewed_at: string | null; created_at: string }>
  const p = payment as Record<string, string | null> | null

  const record: CollaborationRecord = {
    generatedAt: new Date().toISOString(),
    generatedFor: isAdmin && collab.brand_id !== viewerId && collab.influencer_id !== viewerId ? 'Admin' : person(viewerId).name,
    collaboration: {
      id: collab.id as string,
      title: collab.title as string,
      status: COLLABORATION_STATUS_LABELS[collab.status as CollaborationStatus] ?? (collab.status as string),
      source: collab.source === 'offer' ? 'Teklif' : 'İlan başvurusu',
      createdAt: collab.created_at as string,
      publishedAt: (collab.published_at as string | null) ?? null,
      completedAt: (collab.completed_at as string | null) ?? null,
      autoCompleted: !!collab.auto_completed,
      cancelledAt: (collab.cancelled_at as string | null) ?? null,
      cancelReason: (collab.cancel_reason as string | null) ?? null,
      publishUrl: (collab.publish_url as string | null) ?? null,
    },
    brand: person(collab.brand_id as string),
    influencer: person(collab.influencer_id as string),
    agreement: a
      ? {
          fee: formatTry(a.fee_amount),
          paymentType: PAYMENT_TYPE_LABELS[a.payment_type] ?? a.payment_type,
          paymentDueDate: a.payment_due_date ?? null,
          usageRights: a.usage_rights,
          revisionLimit: a.revision_limit,
          version: a.version,
          brandConfirmedAt: a.brand_confirmed_at,
          influencerConfirmedAt: a.influencer_confirmed_at,
        }
      : null,
    deliverables: ((deliverables ?? []) as Array<{ id: string; kind: DeliverableKind; quantity: number; note: string | null; due_date: string | null; status: DeliverableStatus; revisions_used: number; draft_submitted_at: string | null; approved_at: string | null; publish_url: string | null; published_at: string | null }>).map((d) => ({
      id: d.id,
      label: `${DELIVERABLE_KIND_LABELS[d.kind] ?? d.kind}${d.quantity > 1 ? ` ×${d.quantity}` : ''}`,
      note: d.note,
      dueDate: d.due_date,
      status: DELIVERABLE_STATUS_LABELS[d.status] ?? d.status,
      revisionsUsed: d.revisions_used,
      draftSubmittedAt: d.draft_submitted_at,
      approvedAt: d.approved_at,
      publishUrl: d.publish_url,
      publishedAt: d.published_at,
      submissions: subs
        .filter((s) => s.deliverable_id === d.id)
        .map((s) => ({ at: s.created_at, url: s.url, note: s.note, review: s.review, reviewNote: s.review_note, reviewedAt: s.reviewed_at })),
    })),
    payment: p
      ? {
          brandPaidAt: p.brand_paid_at ?? null,
          brandPaidDate: p.brand_paid_date ?? null,
          brandNote: p.brand_note ?? null,
          influencerReceivedAt: p.influencer_received_at ?? null,
          influencerReceivedDate: p.influencer_received_date ?? null,
          influencerNote: p.influencer_note ?? null,
          nonpaymentReportedAt: p.nonpayment_reported_at ?? null,
        }
      : null,
    commitmentAcceptedAt,
    disputes,
    reminders,
    messages,
    messagesTruncated,
  }

  await logPrivacyAccess(admin, { actorId: viewerId, action: 'collab_record_export', subjectUserId: null, resourceId: collab.id as string })
  return record
}

// --- HTML ------------------------------------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const fmt = (value: string | null | undefined) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(value.length === 10 ? {} : { hour: '2-digit', minute: '2-digit' }),
      })
    : '—'

const row = (label: string, value: string) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`
const safeLink = (url: string | null) => {
  if (!url || !/^https?:\/\//i.test(url)) return escapeHtml(url ?? '—')
  return `<a href="${escapeHtml(url)}" rel="noopener noreferrer nofollow">${escapeHtml(url)}</a>`
}

/** Yazdırılabilir, kendi içinde tam HTML belge (dış kaynak yok). */
export function renderCollaborationRecordHtml(r: CollaborationRecord): string {
  const deliverables = r.deliverables.length
    ? r.deliverables
        .map(
          (d) => `
      <section class="block">
        <h3>${escapeHtml(d.label)} <span class="muted">· ${escapeHtml(d.status)}</span></h3>
        <table>
          ${row('Teslim tarihi', escapeHtml(fmt(d.dueDate)))}
          ${row('Not', escapeHtml(d.note ?? '—'))}
          ${row('İlk taslak', escapeHtml(fmt(d.draftSubmittedAt)))}
          ${row('Onay', escapeHtml(fmt(d.approvedAt)))}
          ${row('Yayın', `${escapeHtml(fmt(d.publishedAt))} · ${safeLink(d.publishUrl)}`)}
          ${row('Kullanılan revize', String(d.revisionsUsed))}
        </table>
        ${
          d.submissions.length
            ? `<ol class="list">${d.submissions
                .map(
                  (s) =>
                    `<li>${escapeHtml(fmt(s.at))} · taslak ${safeLink(s.url)}${s.note ? ` · ${escapeHtml(s.note)}` : ''}${
                      s.review ? ` · ${s.review === 'approved' ? 'onaylandı' : `revize istendi: ${escapeHtml(s.reviewNote ?? '')}`} (${escapeHtml(fmt(s.reviewedAt))})` : ''
                    }</li>`,
                )
                .join('')}</ol>`
            : ''
        }
      </section>`,
        )
        .join('')
    : '<p class="muted">Teslimat listesi yok.</p>'

  const events: Array<{ at: string; text: string }> = [{ at: r.collaboration.createdAt, text: `İş birliği başladı (${r.collaboration.source})` }]
  if (r.commitmentAcceptedAt) events.push({ at: r.commitmentAcceptedAt, text: 'Marka iş birliği taahhüdünü onayladı' })
  if (r.agreement?.brandConfirmedAt) events.push({ at: r.agreement.brandConfirmedAt, text: 'Marka anlaşma özetini onayladı' })
  if (r.agreement?.influencerConfirmedAt) events.push({ at: r.agreement.influencerConfirmedAt, text: 'Influencer anlaşma özetini onayladı' })
  if (r.collaboration.publishedAt) events.push({ at: r.collaboration.publishedAt, text: 'Yayın linki girildi' })
  if (r.collaboration.completedAt) events.push({ at: r.collaboration.completedAt, text: `İş birliği tamamlandı${r.collaboration.autoCompleted ? ' (otomatik)' : ''}` })
  if (r.collaboration.cancelledAt) events.push({ at: r.collaboration.cancelledAt, text: `İş birliği iptal edildi${r.collaboration.cancelReason ? `: ${r.collaboration.cancelReason}` : ''}` })
  if (r.payment?.brandPaidAt) events.push({ at: r.payment.brandPaidAt, text: `Marka "ödeme yapıldı" işaretledi (ödeme tarihi ${fmt(r.payment.brandPaidDate)})` })
  if (r.payment?.influencerReceivedAt) events.push({ at: r.payment.influencerReceivedAt, text: `Influencer "ödeme alındı" teyit etti (ödeme tarihi ${fmt(r.payment.influencerReceivedDate)})` })
  if (r.payment?.nonpaymentReportedAt) events.push({ at: r.payment.nonpaymentReportedAt, text: 'Influencer "ödeme alamadım" bildirdi' })
  for (const m of r.reminders) events.push({ at: m.sentAt, text: `${m.kind} (${m.step}. gün)` })
  for (const d of r.disputes) {
    events.push({ at: d.openedAt, text: `${d.kind} bildirimi (${d.status})` })
    if (d.decidedAt) events.push({ at: d.decidedAt, text: `Admin kararı: ${d.status}${d.decisionNote ? ` · ${d.decisionNote}` : ''}` })
  }
  events.sort((x, y) => x.at.localeCompare(y.at))

  const party = (p: Person) => `${escapeHtml(p.name)}${p.username ? ` (@${escapeHtml(p.username)})` : ''}`
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>İş birliği kaydı · ${escapeHtml(r.collaboration.title)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; background: #fff; margin: 0; padding: 24px; }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 13.5px; margin: 12px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; vertical-align: top; padding: 3px 8px 3px 0; }
  th { width: 190px; color: #555; font-weight: 500; }
  .muted { color: #666; font-weight: 400; }
  .note { border: 1px solid #ccc; padding: 8px 10px; border-radius: 6px; background: #fafafa; margin: 12px 0; }
  .list { margin: 6px 0 0 18px; padding: 0; }
  .msg { padding: 4px 0; border-bottom: 1px dotted #e3e3e3; white-space: pre-wrap; word-break: break-word; }
  .msg b { font-weight: 600; }
  .sys { color: #666; font-style: italic; }
  a { color: #0645ad; word-break: break-all; }
  .actions { margin: 12px 0 20px; }
  .actions button { font: inherit; padding: 6px 12px; border: 1px solid #999; border-radius: 6px; background: #f3f3f3; cursor: pointer; }
  @media print { body { padding: 0; } .actions { display: none; } h2 { break-after: avoid; } .block, .msg { break-inside: avoid; } a { color: #111; } }
</style>
</head>
<body>
<main>
  <h1>İş birliği kaydı</h1>
  <p class="muted">${escapeHtml(r.collaboration.title)} · Kayıt no ${escapeHtml(r.collaboration.id)}<br>Oluşturulma: ${escapeHtml(fmt(r.generatedAt))} · İndiren: ${escapeHtml(r.generatedFor)}</p>
  <div class="actions"><button type="button" onclick="window.print()">Yazdır / PDF olarak kaydet</button></div>
  <p class="note">Bu belge Influmatch üzerindeki kayıtlardan otomatik oluşturulmuştur. Ödeme taraflar arasında yapılır; platform üzerinden ödeme alınmaz.</p>

  <h2>Taraflar ve durum</h2>
  <table>
    ${row('Marka', party(r.brand))}
    ${row('Influencer', party(r.influencer))}
    ${row('Durum', escapeHtml(r.collaboration.status))}
    ${row('Başlangıç', escapeHtml(fmt(r.collaboration.createdAt)))}
    ${row('Tamamlanma', escapeHtml(fmt(r.collaboration.completedAt)))}
    ${r.collaboration.publishUrl ? row('Yayın linki', safeLink(r.collaboration.publishUrl)) : ''}
  </table>

  <h2>Anlaşma özeti</h2>
  ${
    r.agreement
      ? `<table>
    ${row('Ücret', `${escapeHtml(r.agreement.fee)} · ${escapeHtml(r.agreement.paymentType)}`)}
    ${row('Ödeme vadesi', escapeHtml(fmt(r.agreement.paymentDueDate)))}
    ${row('Kullanım hakkı', escapeHtml(r.agreement.usageRights ?? '—'))}
    ${row('Revize sayısı', String(r.agreement.revisionLimit))}
    ${row('Sürüm', String(r.agreement.version))}
    ${row('Marka onayı', escapeHtml(fmt(r.agreement.brandConfirmedAt)))}
    ${row('Influencer onayı', escapeHtml(fmt(r.agreement.influencerConfirmedAt)))}
  </table>`
      : '<p class="muted">Anlaşma özeti hazırlanmamış.</p>'
  }
  ${r.commitmentAcceptedAt ? `<p class="note">Markanın onayladığı taahhüt (${escapeHtml(fmt(r.commitmentAcceptedAt))}): ${escapeHtml(COMMITMENT_TEXT)}</p>` : ''}

  <h2>Teslimatlar</h2>
  ${deliverables}

  <h2>Ödeme işaretleri</h2>
  <table>
    ${row('Marka', r.payment?.brandPaidAt ? `Ödeme yapıldı · ödeme tarihi ${escapeHtml(fmt(r.payment.brandPaidDate))} · işaret ${escapeHtml(fmt(r.payment.brandPaidAt))}${r.payment.brandNote ? ` · ${escapeHtml(r.payment.brandNote)}` : ''}` : 'İşaretlenmedi')}
    ${row('Influencer', r.payment?.influencerReceivedAt ? `Ödeme alındı · ödeme tarihi ${escapeHtml(fmt(r.payment.influencerReceivedDate))} · teyit ${escapeHtml(fmt(r.payment.influencerReceivedAt))}${r.payment.influencerNote ? ` · ${escapeHtml(r.payment.influencerNote)}` : ''}` : 'Teyit edilmedi')}
  </table>

  ${
    r.disputes.length
      ? `<h2>Bildirimler</h2>${r.disputes
          .map(
            (d) => `<section class="block"><h3>${escapeHtml(d.kind)} <span class="muted">· ${escapeHtml(d.status)} · ${escapeHtml(fmt(d.openedAt))}</span></h3><table>
        ${row('Bildirim notu', escapeHtml(d.reporterNote ?? '—'))}
        ${row('Yanıt', escapeHtml(d.responseNote ?? '—'))}
        ${row('Kanıt dosyası', d.hasProof ? 'Yüklendi (dosya platformda saklanır)' : '—')}
        ${d.decidedAt ? row('Karar', `${escapeHtml(fmt(d.decidedAt))}${d.decisionNote ? ` · ${escapeHtml(d.decisionNote)}` : ''}`) : ''}
      </table></section>`,
          )
          .join('')}`
      : ''
  }

  <h2>Olaylar</h2>
  <ol class="list">${events.map((e) => `<li>${escapeHtml(fmt(e.at))} · ${escapeHtml(e.text)}</li>`).join('')}</ol>

  <h2>Sohbet</h2>
  ${
    r.messages.length
      ? r.messages
          .map((m) => `<div class="msg${m.system ? ' sys' : ''}"><span class="muted">${escapeHtml(fmt(m.at))}</span> · <b>${escapeHtml(m.sender)}</b>: ${escapeHtml(m.text)}</div>`)
          .join('')
      : '<p class="muted">Bu iş birliğine bağlı sohbet mesajı yok.</p>'
  }
  ${r.messagesTruncated ? `<p class="muted">Yalnızca ilk ${MESSAGE_LIMIT} mesaj gösterildi.</p>` : ''}
</main>
</body>
</html>`
}

// --- Mobil için kısa süreli imzalı bağlantı ----------------------------------------------------------------

function tokenSecret(): string | null {
  const base = process.env.RECORD_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  return base ? `collab-record:${base}` : null
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url')

/** {kullanıcı}.{iş birliği}.{bitiş}.{imza}; 10 dakika geçerli. */
export function createRecordToken(userId: string, collaborationId: string, now = Date.now()): string | null {
  const secret = tokenSecret()
  if (!secret) return null
  const payload = `${userId}.${collaborationId}.${now + TOKEN_TTL_MS}`
  return `${payload}.${sign(payload, secret)}`
}

/** Bağlantıyı doğrular; geçerliyse kullanıcı kimliğini döner. */
export function verifyRecordToken(token: string | null | undefined, collaborationId: string, now = Date.now()): string | null {
  const secret = tokenSecret()
  if (!secret || !token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [userId, collabId, expires, signature] = parts
  if (collabId !== collaborationId || !UUID_RE.test(userId) || !/^\d{10,16}$/.test(expires) || Number(expires) < now) return null
  const expected = Buffer.from(sign(`${userId}.${collabId}.${expires}`, secret))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return userId
}

