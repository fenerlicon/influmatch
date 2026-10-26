// Ret nedenleri ve itirazlar (2026-10-26 kullanıcı isteği; SYSTEM_MAP 6.10). Saf kurallar: web, mobil ve testler aynı listeyi kullanır.
// Mobil kopyası: mobile-app/constants/moderation.js (tests/mobile-parity.test.ts eşitliği denetler).
//
// - Admin kullanıcıyı etkileyen bir reddi (hesap onayı, vergi levhası, görev gönderimi) neden seçmeden veremez.
//   Neden = akışa özel hazır kategori + serbest metin ("Diğer" seçilince zorunlu, en fazla 500 karakter).
// - Her ret bir karar kaydıdır (moderation_decisions). Kullanıcı karar başına bir kez itiraz eder (moderation_appeals,
//   karar başına tek satır). Admin yanıtladıktan sonra aynı karara ikinci itiraz yok; asıl işi (yeni belge, yeni gönderim) yeniden gönderebilir.

export type ModerationSubjectType = 'account' | 'tax_document' | 'task_submission'

export const MODERATION_SUBJECT_TYPES: readonly ModerationSubjectType[] = ['account', 'tax_document', 'task_submission']

export const MODERATION_SUBJECT_LABELS: Record<ModerationSubjectType, string> = {
  account: 'Hesap onayı',
  tax_document: 'Vergi levhası',
  task_submission: 'Görev gönderimi',
}

export interface ReasonOption {
  code: string
  label: string
}

/** Akışa özel hazır nedenler. "other" her listede sondadır ve açıklama ister. */
export const MODERATION_REASONS: Record<ModerationSubjectType, ReasonOption[]> = {
  account: [
    { code: 'missing_info', label: 'Profil bilgileri eksik' },
    { code: 'info_mismatch', label: 'Bilgiler uyuşmuyor' },
    { code: 'unverifiable', label: 'Hesap doğrulanamadı' },
    { code: 'rules_violation', label: 'Kurallara aykırı içerik' },
    { code: 'other', label: 'Diğer' },
  ],
  tax_document: [
    { code: 'unreadable', label: 'Eksik / okunmayan belge' },
    { code: 'info_mismatch', label: 'Bilgiler uyuşmuyor' },
    { code: 'outdated', label: 'Güncel olmayan belge' },
    { code: 'wrong_document', label: 'Yanlış belge' },
    { code: 'other', label: 'Diğer' },
  ],
  task_submission: [
    { code: 'proof_insufficient', label: 'Kanıt yetersiz / okunmuyor' },
    { code: 'rules_not_met', label: 'Görev koşulları sağlanmadı' },
    { code: 'no_ad_tag', label: 'Reklam etiketi yok' },
    { code: 'rules_violation', label: 'Kurallara aykırı içerik' },
    { code: 'other', label: 'Diğer' },
  ],
}

export const REASON_TEXT_MAX = 500
export const APPEAL_TEXT_MAX = 1000
export const APPEAL_RESPONSE_MAX = 1000
export const APPEAL_FILES_BUCKET = 'appeal-files'
export const APPEAL_FILE_MAX_BYTES = 5 * 1024 * 1024
export const APPEAL_FILE_EXTENSIONS = ['pdf', 'jpg', 'png', 'webp'] as const

export type AppealStatus = 'open' | 'accepted' | 'rejected'

export const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  open: 'İnceleniyor',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
}

/** İtiraz kabul edilince ne olur (admin ekranında açıkça yazar). */
export const APPEAL_ACCEPT_EFFECT: Record<ModerationSubjectType, string> = {
  account: 'Hesap yeniden "Bekleyen" durumuna alınır; onayı Kullanıcılar sayfasından ayrıca verirsiniz.',
  tax_document: 'Vergi levhası yeniden "İnceleme gerekli" durumuna alınır; onayı kullanıcı kartından verirsiniz.',
  task_submission: 'Gönderim yeniden "İncelemede" durumuna alınır; onayı Görevler sayfasından verirsiniz.',
}

export interface DecisionReasonInput {
  code?: unknown
  text?: unknown
}

export interface DecisionReason {
  code: string
  label: string
  text: string | null
}

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
}

export function reasonLabel(subjectType: ModerationSubjectType, code: string): string {
  return MODERATION_REASONS[subjectType]?.find((r) => r.code === code)?.label ?? 'Diğer'
}

/** Admin'in seçtiği nedeni doğrular. "Diğer"de açıklama zorunlu (en az 3 karakter). */
export function parseDecisionReason(
  subjectType: ModerationSubjectType,
  input: DecisionReasonInput | null | undefined,
): { ok: true; reason: DecisionReason } | { ok: false; error: string } {
  const options = MODERATION_REASONS[subjectType]
  if (!options) return { ok: false, error: 'Geçersiz karar türü.' }
  const code = typeof input?.code === 'string' ? input.code : ''
  const option = options.find((o) => o.code === code)
  if (!option) return { ok: false, error: 'Ret nedenini seçin (kullanıcıya gösterilir).' }
  const raw = typeof input?.text === 'string' ? input.text : ''
  if (raw.trim().length > REASON_TEXT_MAX) return { ok: false, error: `Açıklama en fazla ${REASON_TEXT_MAX} karakter olabilir.` }
  const text = cleanText(raw, REASON_TEXT_MAX)
  if (code === 'other' && text.length < 3) return { ok: false, error: '"Diğer" seçildiğinde açıklama yazmak zorunlu.' }
  return { ok: true, reason: { code, label: option.label, text: text || null } }
}

/** Kullanıcıya gösterilen tek satırlık neden: "Bilgiler uyuşmuyor: açıklama". "Diğer"de yalnızca açıklama. */
export function formatReason(reason: { code: string; label?: string; text: string | null }, subjectType?: ModerationSubjectType): string {
  const label = reason.label ?? (subjectType ? reasonLabel(subjectType, reason.code) : 'Diğer')
  if (reason.code === 'other') return reason.text || label
  return reason.text ? `${label}: ${reason.text}` : label
}

/** İtiraz metni doğrulaması. */
export function parseAppealMessage(value: unknown): { ok: true; message: string } | { ok: false; error: string } {
  if (typeof value === 'string' && value.trim().length > APPEAL_TEXT_MAX) {
    return { ok: false, error: `İtiraz metni en fazla ${APPEAL_TEXT_MAX} karakter olabilir.` }
  }
  const message = cleanText(value, APPEAL_TEXT_MAX)
  if (message.length < 10) return { ok: false, error: 'İtirazını en az 10 karakterle açıkla.' }
  return { ok: true, message }
}

/** Ek dosya yolu: appeal-files/{userId}/{zaman}.{uzantı} biçiminde olmalı. */
export function isOwnAppealFilePath(userId: string, path: unknown): path is string {
  if (typeof path !== 'string') return false
  const parts = path.split('/')
  return parts.length === 2 && parts[0] === userId && /^\d{10,16}\.(pdf|jpg|png|webp)$/.test(parts[1])
}

export function appealFileExtension(value: unknown): (typeof APPEAL_FILE_EXTENSIONS)[number] | null {
  const ext = String(value ?? '').toLowerCase().replace(/^\./, '')
  const normalized = ext === 'jpeg' ? 'jpg' : ext
  return (APPEAL_FILE_EXTENSIONS as readonly string[]).includes(normalized) ? (normalized as (typeof APPEAL_FILE_EXTENSIONS)[number]) : null
}

/** Kullanıcının gördüğü karar + itiraz durumu (web ve mobil aynı biçim). */
export interface AppealView {
  id: string
  status: AppealStatus
  statusLabel: string
  message: string
  hasAttachment: boolean
  response: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface DecisionView {
  id: string
  subjectType: ModerationSubjectType
  subjectId: string
  reasonCode: string
  reasonLabel: string
  reasonText: string | null
  /** Kullanıcıya gösterilecek tek satır. */
  reason: string
  decidedAt: string
  /** Asıl kayıt hâlâ bu kararla reddedilmiş durumda mı (yeni belge / yeni gönderim / onay sonrası false). */
  current: boolean
  appeal: AppealView | null
  canAppeal: boolean
}
