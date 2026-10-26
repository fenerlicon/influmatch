// Ret kararları ve itirazlar (2026-10-26; SYSTEM_MAP 6.10). Kurallar lib/moderation-shared.ts'te.
//
// Tablolar (moderation_decisions, moderation_appeals) istemci rollerine tamamen kapalıdır: okuma ve yazma yalnızca bu dosyadan
// (service role). Çağıran taraf kullanıcıyı doğrular (web: çerez oturumu, mobil: getBearerContext); burada her işlemde kararın
// gerçekten o kullanıcıya ait olduğu ayrıca kontrol edilir.
//
// Tablolar canlıda yoksa (migration henüz çalıştırılmadıysa) hiçbir işlem çökmez: karar kaydı atlanır (ret yine geçerli,
// neden bildirimde gider), itiraz arayüzü gizlenir, admin sayfası uyarı gösterir.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notify'
import {
  APPEAL_ACCEPT_EFFECT,
  APPEAL_FILES_BUCKET,
  APPEAL_RESPONSE_MAX,
  APPEAL_STATUS_LABELS,
  MODERATION_SUBJECT_LABELS,
  appealFileExtension,
  cleanText,
  formatReason,
  isOwnAppealFilePath,
  parseAppealMessage,
  reasonLabel,
  type AppealStatus,
  type AppealView,
  type DecisionReason,
  type DecisionView,
  type ModerationSubjectType,
} from '@/lib/moderation-shared'

export * from '@/lib/moderation-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { success: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)
const DAY_MS = 24 * 60 * 60 * 1000
const UPLOADS_PER_DAY = 5

const DECISION_COLUMNS = 'id, subject_type, subject_id, user_id, decision, reason_code, reason_text, decided_by, decided_at'
const APPEAL_COLUMNS =
  'id, decision_id, user_id, message, attachment_path, status, response_text, outcome, resolved_by, resolved_at, created_at'

interface DecisionRow {
  id: string
  subject_type: ModerationSubjectType
  subject_id: string
  user_id: string
  decision: string
  reason_code: string
  reason_text: string | null
  decided_by: string | null
  decided_at: string
}

interface AppealRow {
  id: string
  decision_id: string
  user_id: string
  message: string
  attachment_path: string | null
  status: AppealStatus
  response_text: string | null
  outcome: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

/** Tablo canlıda yok (migration çalıştırılmamış): PostgREST şema önbelleği ya da Postgres hatası. */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || (/moderation_(decisions|appeals)/.test(error.message ?? '') && /not find|does not exist|schema cache/i.test(error.message ?? ''))
}

/** Bildirimlerde kullanıcıyı ilgili sayfaya götüren bağlantı (mobil utils/notifications.js routeForLink de tanır). */
export function moderationLink(subjectType: ModerationSubjectType): string {
  if (subjectType === 'tax_document') return '/dashboard/brand/profile?bolum=vergi'
  if (subjectType === 'task_submission') return '/dashboard/tasks'
  return '/dashboard'
}

// --- Karar kaydı (admin eylemleri çağırır) ---------------------------------------------------------

export interface RecordDecisionInput {
  subjectType: ModerationSubjectType
  subjectId: string
  userId: string
  reason: DecisionReason
  decidedBy: string
}

/** Ret kararını kaydeder. Tablo yoksa ya da yazılamazsa null döner; asıl ret işlemi bundan etkilenmez. */
export async function recordDecision(admin: SupabaseClient, input: RecordDecisionInput): Promise<{ id: string } | null> {
  const { data, error } = await admin
    .from('moderation_decisions')
    .insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      user_id: input.userId,
      decision: 'rejected',
      reason_code: input.reason.code,
      reason_text: input.reason.text,
      decided_by: input.decidedBy,
    })
    .select('id')
    .maybeSingle()
  if (error) {
    if (!isMissingTableError(error)) console.error('[moderation] karar kaydedilemedi:', error.message)
    return null
  }
  return data ? { id: data.id as string } : null
}

// --- Kararın güncelliği ----------------------------------------------------------------------------

/**
 * Kararlar hâlâ geçerli mi: asıl kayıt bu kararla reddedilmiş durumda ve kullanıcı yerine yenisini göndermemiş.
 * Hesap: kullanıcı hâlâ "rejected" ve bu, hesabın en son kararı. Vergi levhası: kayıt "rejected" ve kullanıcının en son levhası.
 * Görev: gönderim "rejected" ve aynı görev + tur için daha yeni gönderim yok.
 */
async function currentDecisionIds(admin: SupabaseClient, rows: DecisionRow[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (!rows.length) return out
  const byType = (t: ModerationSubjectType) => rows.filter((r) => r.subject_type === t)

  const accounts = byType('account')
  if (accounts.length) {
    const userIds = Array.from(new Set(accounts.map((r) => r.user_id)))
    const [{ data: users }, { data: latest }] = await Promise.all([
      admin.from('users').select('id, verification_status').in('id', userIds),
      admin
        .from('moderation_decisions')
        .select('id, user_id, decided_at')
        .eq('subject_type', 'account')
        .in('user_id', userIds)
        .order('decided_at', { ascending: false })
        .limit(500),
    ])
    const rejected = new Set(((users ?? []) as Array<{ id: string; verification_status: string | null }>).filter((u) => u.verification_status === 'rejected').map((u) => u.id))
    const newest = new Map<string, string>()
    for (const row of (latest ?? []) as Array<{ id: string; user_id: string }>) if (!newest.has(row.user_id)) newest.set(row.user_id, row.id)
    for (const r of accounts) if (rejected.has(r.user_id) && newest.get(r.user_id) === r.id) out.add(r.id)
  }

  const taxes = byType('tax_document')
  if (taxes.length) {
    const userIds = Array.from(new Set(taxes.map((r) => r.user_id)))
    const { data } = await admin
      .from('tax_verifications')
      .select('id, user_id, status, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(1000)
    const newest = new Map<string, { id: string; status: string }>()
    for (const row of (data ?? []) as Array<{ id: string; user_id: string; status: string }>) if (!newest.has(row.user_id)) newest.set(row.user_id, row)
    for (const r of taxes) {
      const latest = newest.get(r.user_id)
      if (latest && latest.id === r.subject_id && latest.status === 'rejected') out.add(r.id)
    }
  }

  const tasks = byType('task_submission')
  if (tasks.length) {
    const { data: subs } = await admin
      .from('task_submissions')
      .select('id, task_id, user_id, round, status, created_at')
      .in('id', tasks.map((r) => r.subject_id))
    const subRows = (subs ?? []) as Array<{ id: string; task_id: string; user_id: string; round: number; status: string; created_at: string }>
    const rejectedSubs = subRows.filter((s) => s.status === 'rejected')
    if (rejectedSubs.length) {
      const { data: siblings } = await admin
        .from('task_submissions')
        .select('id, task_id, user_id, round, created_at')
        .in('task_id', Array.from(new Set(rejectedSubs.map((s) => s.task_id))))
        .in('user_id', Array.from(new Set(rejectedSubs.map((s) => s.user_id))))
        .limit(2000)
      const sibs = (siblings ?? []) as Array<{ id: string; task_id: string; user_id: string; round: number; created_at: string }>
      const currentSubs = new Set(
        rejectedSubs
          .filter((s) => !sibs.some((o) => o.id !== s.id && o.task_id === s.task_id && o.user_id === s.user_id && o.round === s.round && o.created_at > s.created_at))
          .map((s) => s.id),
      )
      for (const r of tasks) if (currentSubs.has(r.subject_id)) out.add(r.id)
    }
  }
  return out
}

function appealView(row: AppealRow): AppealView {
  return {
    id: row.id,
    status: row.status,
    statusLabel: APPEAL_STATUS_LABELS[row.status] ?? row.status,
    message: row.message,
    hasAttachment: !!row.attachment_path,
    response: row.response_text,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

function decisionView(row: DecisionRow, appeal: AppealRow | undefined, current: boolean): DecisionView {
  const label = reasonLabel(row.subject_type, row.reason_code)
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reasonCode: row.reason_code,
    reasonLabel: label,
    reasonText: row.reason_text,
    reason: formatReason({ code: row.reason_code, label, text: row.reason_text }),
    decidedAt: row.decided_at,
    current,
    appeal: appeal ? appealView(appeal) : null,
    // Karar başına tek itiraz; yalnızca asıl kayıt hâlâ bu kararla reddedilmişken.
    canAppeal: current && !appeal,
  }
}

export interface UserDecisionsResult {
  /** Tablolar canlıda var mı (yoksa itiraz arayüzü gizlenir). */
  available: boolean
  decisions: DecisionView[]
}

/**
 * Kullanıcının kendi kararları (en yeni önce). subjectIds verilirse yalnızca o kayıtlara ait kararlar.
 * Hesap ve vergi levhası için ekranlar en son kararı kullanır.
 */
export async function loadUserDecisions(
  admin: SupabaseClient | null,
  userId: string,
  opts: { subjectType?: ModerationSubjectType; subjectIds?: string[]; limit?: number } = {},
): Promise<UserDecisionsResult> {
  if (!admin || !isUuid(userId)) return { available: false, decisions: [] }
  if (opts.subjectIds && !opts.subjectIds.length) return { available: true, decisions: [] }
  let query = admin.from('moderation_decisions').select(DECISION_COLUMNS).eq('user_id', userId)
  if (opts.subjectType) query = query.eq('subject_type', opts.subjectType)
  if (opts.subjectIds) query = query.in('subject_id', opts.subjectIds.filter(isUuid).slice(0, 200))
  const { data, error } = await query.order('decided_at', { ascending: false }).limit(opts.limit ?? 50)
  if (error) {
    if (!isMissingTableError(error)) console.error('[moderation] kararlar okunamadı:', error.message)
    return { available: !isMissingTableError(error), decisions: [] }
  }
  const rows = (data ?? []) as DecisionRow[]
  if (!rows.length) return { available: true, decisions: [] }
  const [{ data: appeals }, current] = await Promise.all([
    admin.from('moderation_appeals').select(APPEAL_COLUMNS).in('decision_id', rows.map((r) => r.id)),
    currentDecisionIds(admin, rows),
  ])
  const appealOf = new Map(((appeals ?? []) as AppealRow[]).map((a) => [a.decision_id, a]))
  return { available: true, decisions: rows.map((r) => decisionView(r, appealOf.get(r.id), current.has(r.id))) }
}

/** Ekranın gösterdiği tek karar: türün en son kararı (hesap, vergi levhası). */
export async function loadLatestDecision(
  admin: SupabaseClient | null,
  userId: string,
  subjectType: ModerationSubjectType,
): Promise<{ available: boolean; decision: DecisionView | null }> {
  const result = await loadUserDecisions(admin, userId, { subjectType, limit: 1 })
  return { available: result.available, decision: result.decisions[0] ?? null }
}

// --- İtiraz (kullanıcı) ----------------------------------------------------------------------------

/** İtiraz eki için tek kullanımlık imzalı yükleme adresi (kova istemcilere kapalı). Günde en fazla 5 yükleme. */
export async function createAppealUploadUrlAs(
  admin: SupabaseClient | null,
  userId: string,
  extension: unknown,
): Promise<Result<{ path: string; token: string }>> {
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }
  const ext = appealFileExtension(extension)
  if (!ext) return { success: false, error: 'Yalnızca PDF, JPG, PNG veya WEBP yükleyebilirsin.' }
  try {
    const { data: files } = await admin.storage.from(APPEAL_FILES_BUCKET).list(userId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    const since = Date.now() - DAY_MS
    if ((files ?? []).filter((f) => f.created_at && Date.parse(f.created_at) >= since).length >= UPLOADS_PER_DAY) {
      return { success: false, error: 'Günde en fazla 5 dosya yükleyebilirsin. Lütfen yarın tekrar dene.' }
    }
    const path = `${userId}/${Date.now()}.${ext}`
    const { data, error } = await admin.storage.from(APPEAL_FILES_BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[moderation] yükleme adresi alınamadı:', error?.message)
      return { success: false, error: 'Dosya yüklenemedi. Ek olmadan da itiraz edebilirsin.' }
    }
    return { success: true, path: data.path, token: data.token }
  } catch (error) {
    console.error('[moderation] yükleme adresi alınamadı:', error)
    return { success: false, error: 'Dosya yüklenemedi. Ek olmadan da itiraz edebilirsin.' }
  }
}

async function appealFileExists(admin: SupabaseClient, userId: string, path: string) {
  const name = path.split('/')[1]
  const { data } = await admin.storage.from(APPEAL_FILES_BUCKET).list(userId, { search: name, limit: 5 })
  return (data ?? []).some((f) => f.name === name)
}

export interface SubmitAppealInput {
  decisionId?: unknown
  message?: unknown
  attachmentPath?: unknown
}

/** İtiraz gönderir: karar kullanıcıya ait olmalı, hâlâ geçerli olmalı ve daha önce itiraz edilmemiş olmalı. */
export async function submitAppealAs(admin: SupabaseClient | null, userId: string, input: SubmitAppealInput): Promise<Result<{ appeal: AppealView }>> {
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }
  if (!isUuid(input.decisionId)) return { success: false, error: 'Karar bulunamadı.' }
  const parsed = parseAppealMessage(input.message)
  if (!parsed.ok) return { success: false, error: parsed.error }

  const { data: row, error: readError } = await admin.from('moderation_decisions').select(DECISION_COLUMNS).eq('id', input.decisionId).maybeSingle()
  if (readError) {
    if (isMissingTableError(readError)) return { success: false, error: 'İtiraz şu an açık değil. Lütfen destek talebi aç.' }
    return { success: false, error: 'Karar okunamadı. Lütfen tekrar dene.' }
  }
  const decision = row as DecisionRow | null
  // Başkasının kararı "bulunamadı" ile aynı yanıtı alır (var olduğu sızmaz).
  if (!decision || decision.user_id !== userId) return { success: false, error: 'Karar bulunamadı.' }

  const current = await currentDecisionIds(admin, [decision])
  if (!current.has(decision.id)) {
    return { success: false, error: 'Bu karar artık geçerli değil (yeni gönderim ya da durum değişikliği var); itiraz edilemez.' }
  }

  let attachmentPath: string | null = null
  if (input.attachmentPath !== undefined && input.attachmentPath !== null && input.attachmentPath !== '') {
    if (!isOwnAppealFilePath(userId, input.attachmentPath) || !(await appealFileExists(admin, userId, input.attachmentPath))) {
      return { success: false, error: 'Ek dosya bulunamadı. Lütfen yeniden yükle.' }
    }
    attachmentPath = input.attachmentPath
  }

  // decision_id benzersiz: karar başına tek itiraz (aynı anda iki istek gelirse ikincisi 23505 alır).
  const { data: inserted, error } = await admin
    .from('moderation_appeals')
    .insert({ decision_id: decision.id, user_id: userId, message: parsed.message, attachment_path: attachmentPath, status: 'open' })
    .select(APPEAL_COLUMNS)
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Bu karara zaten itiraz ettin.' }
    console.error('[moderation] itiraz yazılamadı:', error.message)
    return { success: false, error: 'İtiraz gönderilemedi. Lütfen tekrar dene.' }
  }
  return { success: true, appeal: appealView(inserted as AppealRow) }
}

// --- Admin -----------------------------------------------------------------------------------------

export interface AdminAppealView {
  id: string
  status: AppealStatus
  message: string
  hasAttachment: boolean
  response: string | null
  outcome: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  decision: {
    id: string
    subjectType: ModerationSubjectType
    subjectLabel: string
    subjectId: string
    subjectSummary: string | null
    reason: string
    decidedAt: string
    decidedBy: string | null
    current: boolean
  }
  user: { id: string; name: string; username: string | null; email: string | null; role: string | null; verificationStatus: string | null }
  acceptEffect: string
}

export interface AdminAppealsResult {
  available: boolean
  appeals: AdminAppealView[]
  counts: Record<AppealStatus, number>
}

export async function countOpenAppeals(admin: SupabaseClient | null): Promise<number> {
  if (!admin) return 0
  const { count, error } = await admin.from('moderation_appeals').select('id', { count: 'exact', head: true }).eq('status', 'open')
  if (error) return 0
  return count ?? 0
}

export async function loadAdminAppeals(
  admin: SupabaseClient,
  filters: { status?: AppealStatus | 'all'; type?: ModerationSubjectType | 'all' } = {},
): Promise<AdminAppealsResult> {
  const counts: Record<AppealStatus, number> = { open: 0, accepted: 0, rejected: 0 }
  const { data: statusRows, error: countError } = await admin.from('moderation_appeals').select('status').limit(10000)
  if (countError) {
    if (!isMissingTableError(countError)) console.error('[moderation] itirazlar sayılamadı:', countError.message)
    return { available: !isMissingTableError(countError), appeals: [], counts }
  }
  for (const r of (statusRows ?? []) as Array<{ status: AppealStatus }>) if (r.status in counts) counts[r.status]++

  let query = admin.from('moderation_appeals').select(APPEAL_COLUMNS)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  const { data, error } = await query.order('created_at', { ascending: filters.status === 'open' }).limit(300)
  if (error) throw new Error(error.message)
  const appealRows = (data ?? []) as AppealRow[]
  if (!appealRows.length) return { available: true, appeals: [], counts }

  const { data: decisionData } = await admin.from('moderation_decisions').select(DECISION_COLUMNS).in('id', appealRows.map((a) => a.decision_id))
  let decisions = (decisionData ?? []) as DecisionRow[]
  if (filters.type && filters.type !== 'all') decisions = decisions.filter((d) => d.subject_type === filters.type)
  const decisionById = new Map(decisions.map((d) => [d.id, d]))

  const peopleIds = Array.from(
    new Set([
      ...appealRows.map((a) => a.user_id),
      ...appealRows.map((a) => a.resolved_by).filter((v): v is string => !!v),
      ...decisions.map((d) => d.decided_by).filter((v): v is string => !!v),
    ]),
  )
  const people = new Map<string, { full_name: string | null; username: string | null; email: string | null; role: string | null; verification_status: string | null }>()
  for (let i = 0; i < peopleIds.length; i += 200) {
    const { data: users } = await admin.from('users').select('id, full_name, username, email, role, verification_status').in('id', peopleIds.slice(i, i + 200))
    for (const u of (users ?? []) as Array<{ id: string; full_name: string | null; username: string | null; email: string | null; role: string | null; verification_status: string | null }>) {
      people.set(u.id, u)
    }
  }
  const nameOf = (id: string | null) => {
    if (!id) return null
    const p = people.get(id)
    return p?.full_name || (p?.username ? `@${p.username}` : null) || p?.email || null
  }

  // Görev gönderimi özeti: görev adı + tur.
  const taskSubIds = decisions.filter((d) => d.subject_type === 'task_submission').map((d) => d.subject_id)
  const taskSummary = new Map<string, string>()
  if (taskSubIds.length) {
    const { data: subs } = await admin.from('task_submissions').select('id, task_id, round, post_url').in('id', taskSubIds)
    const subRows = (subs ?? []) as Array<{ id: string; task_id: string; round: number; post_url: string | null }>
    const { data: tasks } = subRows.length
      ? await admin.from('platform_tasks').select('id, title, max_rounds').in('id', Array.from(new Set(subRows.map((s) => s.task_id))))
      : { data: [] }
    const taskById = new Map(((tasks ?? []) as Array<{ id: string; title: string; max_rounds: number }>).map((t) => [t.id, t]))
    for (const s of subRows) {
      const t = taskById.get(s.task_id)
      taskSummary.set(s.id, `${t?.title ?? 'Görev'}${t && t.max_rounds > 1 ? ` · ${s.round}. tur` : ''}${s.post_url ? ` · ${s.post_url}` : ''}`)
    }
  }

  const current = await currentDecisionIds(admin, decisions)
  const appeals: AdminAppealView[] = []
  for (const a of appealRows) {
    const d = decisionById.get(a.decision_id)
    if (!d) continue
    const p = people.get(a.user_id)
    appeals.push({
      id: a.id,
      status: a.status,
      message: a.message,
      hasAttachment: !!a.attachment_path,
      response: a.response_text,
      outcome: a.outcome,
      createdAt: a.created_at,
      resolvedAt: a.resolved_at,
      resolvedBy: nameOf(a.resolved_by),
      decision: {
        id: d.id,
        subjectType: d.subject_type,
        subjectLabel: MODERATION_SUBJECT_LABELS[d.subject_type],
        subjectId: d.subject_id,
        subjectSummary: d.subject_type === 'task_submission' ? taskSummary.get(d.subject_id) ?? null : null,
        reason: formatReason({ code: d.reason_code, text: d.reason_text }, d.subject_type),
        decidedAt: d.decided_at,
        decidedBy: nameOf(d.decided_by),
        current: current.has(d.id),
      },
      user: {
        id: a.user_id,
        name: nameOf(a.user_id) ?? 'Silinmiş kullanıcı',
        username: p?.username ?? null,
        email: p?.email ?? null,
        role: p?.role ?? null,
        verificationStatus: p?.verification_status ?? null,
      },
      acceptEffect: APPEAL_ACCEPT_EFFECT[d.subject_type],
    })
  }
  return { available: true, appeals, counts }
}

/** İtiraz ekini admin için 10 dakikalık imzalı bağlantıyla açar. */
export async function appealAttachmentUrl(admin: SupabaseClient, appealId: string): Promise<Result<{ url: string }>> {
  if (!isUuid(appealId)) return { success: false, error: 'İtiraz bulunamadı.' }
  const { data } = await admin.from('moderation_appeals').select('attachment_path').eq('id', appealId).maybeSingle()
  if (!data?.attachment_path) return { success: false, error: 'Ek yok.' }
  const { data: signed, error } = await admin.storage.from(APPEAL_FILES_BUCKET).createSignedUrl(data.attachment_path as string, 600)
  if (error || !signed) return { success: false, error: 'Ek bağlantısı oluşturulamadı.' }
  return { success: true, url: signed.signedUrl }
}

type RevertOutcome = { ok: true; changed: boolean } | { ok: false; error: string }

/** Kabul edilen itirazda asıl kaydı yeniden incelemeye alır (yalnızca hâlâ bu kararla reddedilmişse). */
async function revertDecision(admin: SupabaseClient, decision: DecisionRow, isCurrent: boolean): Promise<RevertOutcome> {
  if (!isCurrent) return { ok: true, changed: false }
  const now = new Date().toISOString()
  if (decision.subject_type === 'account') {
    const { data, error } = await admin
      .from('users')
      .update({ verification_status: 'pending' })
      .eq('id', decision.user_id)
      .eq('verification_status', 'rejected')
      .select('id')
    if (error) return { ok: false, error: `Hesap durumu değiştirilemedi: ${error.message}` }
    return { ok: true, changed: (data ?? []).length > 0 }
  }
  if (decision.subject_type === 'tax_document') {
    const { data, error } = await admin
      .from('tax_verifications')
      .update({ status: 'needs_review', reasons: ['İtirazınız kabul edildi; belgeniz yeniden inceleniyor.'], updated_at: now })
      .eq('id', decision.subject_id)
      .eq('status', 'rejected')
      .select('id')
    if (error) return { ok: false, error: `Vergi levhası durumu değiştirilemedi: ${error.message}` }
    return { ok: true, changed: (data ?? []).length > 0 }
  }
  const { data, error } = await admin
    .from('task_submissions')
    .update({ status: 'in_review', reviewed_by: null, reviewed_at: null, updated_at: now })
    .eq('id', decision.subject_id)
    .eq('status', 'rejected')
    .select('id')
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Kullanıcının bu görev turu için yeni bir gönderimi var. Yeni gönderimi Görevler sayfasından inceleyin ya da itirazı yanıtla reddedin.' }
    }
    return { ok: false, error: `Gönderim durumu değiştirilemedi: ${error.message}` }
  }
  return { ok: true, changed: (data ?? []).length > 0 }
}

/** Admin itirazı yanıtlar. Kabulde asıl kayıt yeniden incelemeye alınır; retle yanıt metni zorunludur. Kullanıcı bildirim alır. */
export async function resolveAppealAsAdmin(
  admin: SupabaseClient,
  adminUserId: string,
  appealId: string,
  action: 'accept' | 'reject',
  responseInput: unknown,
): Promise<Result<{ message: string }>> {
  if (!isUuid(appealId)) return { success: false, error: 'İtiraz bulunamadı.' }
  if (action !== 'accept' && action !== 'reject') return { success: false, error: 'Geçersiz işlem.' }
  if (typeof responseInput === 'string' && responseInput.trim().length > APPEAL_RESPONSE_MAX) {
    return { success: false, error: `Yanıt en fazla ${APPEAL_RESPONSE_MAX} karakter olabilir.` }
  }
  const response = cleanText(responseInput, APPEAL_RESPONSE_MAX) || null
  if (action === 'reject' && (!response || response.length < 3)) return { success: false, error: 'Reddederken yanıt yazmak zorunlu (kullanıcıya gösterilir).' }

  const { data: appealData, error: readError } = await admin.from('moderation_appeals').select(APPEAL_COLUMNS).eq('id', appealId).maybeSingle()
  if (readError) return { success: false, error: isMissingTableError(readError) ? 'İtiraz tabloları canlıda yok.' : readError.message }
  const appeal = appealData as AppealRow | null
  if (!appeal) return { success: false, error: 'İtiraz bulunamadı.' }
  if (appeal.status !== 'open') return { success: false, error: 'Bu itiraz zaten yanıtlanmış.' }
  const { data: decisionData } = await admin.from('moderation_decisions').select(DECISION_COLUMNS).eq('id', appeal.decision_id).maybeSingle()
  const decision = decisionData as DecisionRow | null
  if (!decision) return { success: false, error: 'Karar bulunamadı.' }

  const now = new Date().toISOString()
  // Önce itirazı koşullu kapat: iki admin aynı anda yanıtlarsa yalnızca biri geçer.
  const { data: closed, error: closeError } = await admin
    .from('moderation_appeals')
    .update({ status: action === 'accept' ? 'accepted' : 'rejected', response_text: response, resolved_by: adminUserId, resolved_at: now })
    .eq('id', appeal.id)
    .eq('status', 'open')
    .select('id')
    .maybeSingle()
  if (closeError) return { success: false, error: `Yanıt kaydedilemedi: ${closeError.message}` }
  if (!closed) return { success: false, error: 'Bu itiraz zaten yanıtlanmış.' }

  let outcome = 'rejected'
  let adminMessage = 'İtiraz reddedildi; kullanıcıya bildirildi.'
  if (action === 'accept') {
    const isCurrent = (await currentDecisionIds(admin, [decision])).has(decision.id)
    const reverted = await revertDecision(admin, decision, isCurrent)
    if (!reverted.ok) {
      // Asıl kayıt değiştirilemedi: itiraz yeniden açılır, admin tekrar dener ya da reddeder.
      await admin.from('moderation_appeals').update({ status: 'open', response_text: null, resolved_by: null, resolved_at: null }).eq('id', appeal.id)
      return { success: false, error: reverted.error }
    }
    outcome = reverted.changed ? 'reopened' : 'unchanged'
    adminMessage = reverted.changed
      ? `İtiraz kabul edildi. ${APPEAL_ACCEPT_EFFECT[decision.subject_type]}`
      : 'İtiraz kabul edildi. Kayıt artık bu kararla reddedilmiş durumda olmadığı için değişiklik yapılmadı.'
  }
  await admin.from('moderation_appeals').update({ outcome }).eq('id', appeal.id)

  const subject = MODERATION_SUBJECT_LABELS[decision.subject_type].toLocaleLowerCase('tr-TR')
  const acceptedText: Record<ModerationSubjectType, string> = {
    account: 'Hesabın yeniden incelemeye alındı. Sonucu ayrıca bildireceğiz.',
    tax_document: 'Vergi levhan yeniden incelemeye alındı. Sonucu ayrıca bildireceğiz.',
    task_submission: 'Görev gönderimin yeniden incelemeye alındı. Sonucu ayrıca bildireceğiz.',
  }
  await notifyUser(
    {
      userId: decision.user_id,
      event: 'appeal_result',
      title: action === 'accept' ? 'İtirazın kabul edildi' : 'İtirazın reddedildi',
      message:
        action === 'accept'
          ? `${MODERATION_SUBJECT_LABELS[decision.subject_type]} itirazın kabul edildi. ${acceptedText[decision.subject_type]}${response ? ` Not: ${response}` : ''}`
          : `${MODERATION_SUBJECT_LABELS[decision.subject_type]} itirazın incelendi ve reddedildi. Yanıt: ${response}`,
      link: moderationLink(decision.subject_type),
      type: action === 'accept' ? 'success' : 'warning',
      email: {
        subject: action === 'accept' ? 'İtirazın kabul edildi' : 'İtirazın reddedildi',
        text:
          action === 'accept'
            ? `${subject} kararına yaptığın itiraz kabul edildi. ${acceptedText[decision.subject_type]}${response ? `\n\nNot: ${response}` : ''}`
            : `${subject} kararına yaptığın itiraz incelendi ve reddedildi.\n\nYanıt: ${response}`,
      },
    },
    admin,
  )
  return { success: true, message: adminMessage }
}
