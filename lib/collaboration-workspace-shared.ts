// İş birliği takip alanı sabitleri (sunucu ve tarayıcı ortak; sunucuya özel içe aktarım yok).
// Mobil karşılığı: mobile-app/constants/collaborationWorkspace.js (ikisi birlikte değişir).

export type DeliverableKind = 'story' | 'reel' | 'post' | 'ugc_video' | 'other'
export type DeliverableStatus = 'pending' | 'draft_submitted' | 'revision_requested' | 'approved' | 'published'
export type AgreementPaymentType = 'cash' | 'barter'

export const DELIVERABLE_KINDS: DeliverableKind[] = ['story', 'reel', 'post', 'ugc_video', 'other']

export const DELIVERABLE_KIND_LABELS: Record<DeliverableKind, string> = {
  story: 'Story',
  reel: 'Reels',
  post: 'Gönderi',
  ugc_video: 'UGC video',
  other: 'Diğer',
}

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: 'Bekliyor',
  draft_submitted: 'Taslak gönderildi',
  revision_requested: 'Revize istendi',
  approved: 'Onaylandı',
  published: 'Yayınlandı',
}

export const PAYMENT_TYPE_LABELS: Record<AgreementPaymentType, string> = {
  cash: 'Nakit',
  barter: 'Barter',
}

/** Anlaşma özetinin altındaki tek nötr satır. Hukuki şablon metni avukattan gelecek; buraya yazılmaz. */
export const AGREEMENT_SUMMARY_NOTE = 'Bu özet iki tarafın uygulamada onayladığı bilgileri gösterir.'

/** İş birliği tamamlandıktan bu kadar gün sonra influencer ödemeyi teyit etmediyse "Ödeme alamadım" düğmesi görünür. */
export const NONPAYMENT_REPORT_DAYS = 14

export const AGREEMENT_LIMITS = {
  maxDeliverables: 20,
  maxQuantity: 50,
  maxFee: 10_000_000,
  maxRevisions: 10,
  usageRightsMax: 300,
  deliverableNoteMax: 200,
  draftNoteMax: 500,
  reviewNoteMax: 500,
  paymentNoteMax: 300,
} as const

export type WorkspaceActionName =
  | 'save_agreement'
  | 'confirm_agreement'
  | 'submit_draft'
  | 'approve_draft'
  | 'request_revision'
  | 'publish_deliverable'
  | 'mark_paid'
  | 'unmark_paid'
  | 'confirm_payment'
  | 'unconfirm_payment'
  | 'report_nonpayment'

export const WORKSPACE_ACTIONS: WorkspaceActionName[] = [
  'save_agreement',
  'confirm_agreement',
  'submit_draft',
  'approve_draft',
  'request_revision',
  'publish_deliverable',
  'mark_paid',
  'unmark_paid',
  'confirm_payment',
  'unconfirm_payment',
  'report_nonpayment',
]

export type DeliverableAction = 'submit_draft' | 'approve_draft' | 'request_revision' | 'publish_deliverable'

export interface DeliverableInput {
  id?: string | null
  kind: DeliverableKind
  quantity: number
  note?: string | null
  due_date?: string | null
}

export interface AgreementInput {
  fee_amount: number | null
  payment_type: AgreementPaymentType
  usage_rights?: string | null
  revision_limit: number
  deliverables: DeliverableInput[]
}

/** "X / Y revize kullanıldı" */
export function revisionUsageText(used: number, limit: number) {
  return `${used} / ${limit} revize kullanıldı`
}

/** Marka güvenilirlik satırı: "X iş birliği, Y ödeme teyitli". */
export function reliabilityText(completed: number, confirmed: number) {
  return `${completed} iş birliği, ${confirmed} ödeme teyitli`
}

export function formatTry(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString('tr-TR')} ₺`
}
