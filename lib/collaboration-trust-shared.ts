// Güvenli iş birliği (2026-11-23; SYSTEM_MAP 15). Emanet yok: platform para tutmaz, ödeme taraflar arasında (CLAUDE.md 2026-10-15).
// Saf kurallar ve metinler: sunucu, web arayüzü, testler aynı dosyayı kullanır. Mobil kopyası: mobile-app/constants/trust.js
// (tests/mobile-parity.test.ts eşitliği denetler).
//
// - Marka taahhüdü: ilk ilan ya da ilk tekliften önce bir kez kabul edilir (metin sürümüyle). Metin avukat kontrolü bekliyor.
// - Anlaşma özetinde ücret (₺) ve ödeme vadesi; yeni anlaşmalarda nakit ödemede vade zorunlu.
// - Tek taraflı tamamlama yok: iş bitip (tamamlandı ya da bütün teslimatlar onaylandı) iki taraf ödemeyi teyit edene kadar
//   markaya 0 / 3 / 7 / 14. gün, marka "ödeme yapıldı" dedikten sonra influencer'a 2 / 5 / 10. gün hatırlatma.
// - Anlaşmazlık: bildirimden sonra karşı tarafın 7 günü var; kanıt yoksa hesap incelemeye alınır, son kararı admin verir.

/** Taahhüt metni sürümü. Metin değişirse sürüm de değişir ve markalar yeniden onaylar. */
export const COMMITMENT_VERSION = '2026-11-23'

/** Avukat kontrolü bekliyor (docs/SYSTEM_MAP.md 15). Metin kullanıcı kararıyla aynen yazıldı. */
export const COMMITMENT_TEXT =
  'Bu iş birliğinin tüm yazışma, onay ve teslim kayıtları saklanır. Ödeme yapılmazsa influencer bu kayıtları yasal süreçte kullanabilir; ödeme yapmayan markaların hesabı askıya alınır.'

/** Anlaşma özeti ve ödeme bölümündeki kısa hali (aynı uyarı). */
export const COMMITMENT_SHORT = 'Yazışma, onay ve teslim kayıtları saklanır; ödeme yapmayan markaların hesabı askıya alınır.'

export const COMMITMENT_CHECKBOX_LABEL = 'Okudum, kabul ediyorum.'

/** Sunucunun taahhüt eksikken döndürdüğü hata; web ve mobil bu metni görünce taahhüt penceresini açar. */
export const COMMITMENT_REQUIRED_ERROR = 'Devam etmeden önce iş birliği taahhüdünü onaylaman gerekiyor.'
export const ACCOUNT_HOLD_ERROR =
  'Hesabın bir ödeme / teslim anlaşmazlığı nedeniyle incelemede. İnceleme bitene kadar yeni ilan, teklif ve başvuru yapılamaz.'
export const ACCOUNT_SUSPENDED_ERROR = 'Hesabın askıya alındı. Yeni ilan, teklif ve başvuru yapılamaz; karara itiraz edebilirsin.'

/** Marka ödeme hatırlatmaları: ödeme vadesi ile işin bitişinden geç olanından sonraki günler. */
export const PAYMENT_REMINDER_DAYS = [0, 3, 7, 14] as const
/** Influencer teyit hatırlatmaları: marka "ödeme yapıldı" dedikten sonraki günler. */
export const RECEIPT_REMINDER_DAYS = [2, 5, 10] as const

/**
 * Ödeme teyidi süresi (saat; kullanıcı kararı 2026-11-24): marka "Ödeme yapıldı" dedikten sonra influencer bu süre içinde
 * "Ödeme alındı" ya da "Ödeme gelmedi" der. Süre dolunca marka dekontla "Ödemeyi yaptım ama onaylanmadı" başvurusu yapabilir.
 */
export const PAYMENT_CONFIRM_HOURS = 24

/** Anlaşmazlıkta karşı tarafın yanıt süresi (gün). */
export const DISPUTE_RESPONSE_DAYS = 7
/** "Teslim edilmedi" bildirimi: teslim tarihinden bu kadar gün sonra açılır. */
export const NONDELIVERY_GRACE_DAYS = 3

export const DISPUTE_PROOF_BUCKET = 'payment-proofs'
export const DISPUTE_PROOF_MAX_BYTES = 10 * 1024 * 1024
export const DISPUTE_PROOF_EXTENSIONS = ['pdf', 'jpg', 'png', 'webp'] as const
export const DISPUTE_NOTE_MAX = 1000

/**
 * Rozet eşikleri (tek yer). Saatlik görevde hesaplanır (lib/trust-badges.ts); kuralı artık sağlamayanın rozeti geri alınır.
 * Zamanında Ödeme (marka): iki tarafça teyitli ödemesi olan en az 3 iş birliği, bunların en az %90'ı vadesinde ya da önce,
 *   son 12 ayda haklı bulunmuş (upheld) ödeme anlaşmazlığı yok.
 * Zamanında Teslim (influencer): en az 3 tamamlanan iş birliği, tarihli teslimatların en az %90'ı tarihinde ya da önce
 *   onaylandı / yayınlandı, son 12 ayda haklı bulunmuş teslim anlaşmazlığı yok.
 */
export const TRUST_BADGE_RULES = {
  onTimePayment: { badgeId: 'on-time-payment', minCollaborations: 3, minOnTimeRatio: 0.9, disputeWindowDays: 365 },
  onTimeDelivery: { badgeId: 'on-time-delivery', minCompleted: 3, minOnTimeRatio: 0.9, disputeWindowDays: 365 },
} as const

export type DisputeKind = 'nonpayment' | 'nondelivery' | 'payment_unconfirmed'
export type DisputeStatus = 'open' | 'responded' | 'resolved' | 'escalated' | 'upheld' | 'dismissed' | 'paid'
export const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = ['open', 'responded', 'escalated']

export const DISPUTE_KIND_LABELS: Record<DisputeKind, string> = {
  nonpayment: 'Ödeme alınamadı',
  nondelivery: 'Teslim edilmedi',
  payment_unconfirmed: 'Ödeme teyit edilmedi',
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Yanıt bekleniyor',
  responded: 'Yanıt verildi',
  resolved: 'Çözüldü',
  escalated: 'İncelemede',
  upheld: 'Hesap askıya alındı',
  dismissed: 'Kapatıldı',
  paid: 'Ödendi olarak kapatıldı',
}

export type PaymentProgress = 'none' | 'awaiting_brand' | 'awaiting_influencer' | 'confirmed'

/** "Ödeme bekleniyor / Onay bekleniyor" durumu (iki taraf da görür). */
export const PAYMENT_PROGRESS_LABELS: Record<PaymentProgress, string> = {
  none: '',
  awaiting_brand: 'Ödeme bekleniyor',
  awaiting_influencer: 'Onay bekleniyor',
  confirmed: 'Ödeme iki tarafça teyit edildi',
}

const DAY_MS = 24 * 60 * 60 * 1000

const toTime = (value: string | null | undefined): number | null => {
  if (!value) return null
  const t = new Date(value.length === 10 ? `${value}T00:00:00Z` : value).getTime()
  return Number.isFinite(t) ? t : null
}

/** YYYY-AA-GG; geçerli takvim günü değilse null. */
export function parseDueDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return null
  return raw
}

/**
 * Ödeme vadesi doğrulaması. Nakit ödemede yeni anlaşmada zorunlu (required); barter'da isteğe bağlı.
 * Yeni ya da değişen vade bugünden önce veya 3 yıldan sonra olamaz; eski (geçmiş) vade değişmeden kalabilir.
 */
export function validatePaymentDueDate(
  raw: unknown,
  opts: { required: boolean; previous: string | null; today: string },
): { value: string | null } | { error: string } {
  if (raw === null || raw === undefined || raw === '') {
    return opts.required ? { error: 'Ödeme vadesini (son ödeme tarihi) girin.' } : { value: null }
  }
  const date = parseDueDate(raw)
  if (!date) return { error: 'Ödeme vadesi geçersiz.' }
  if (date !== opts.previous) {
    const today = toTime(opts.today) ?? Date.now()
    const t = toTime(date)!
    if (t < today - DAY_MS || t > today + 3 * 365 * DAY_MS) return { error: 'Ödeme vadesi bugünden önce veya 3 yıldan sonra olamaz.' }
  }
  return { value: date }
}

/** İşin bittiği an: iş birliği tamamlandı ya da bütün teslimatlar onaylandı (hangisi önceyse). Yoksa null. */
export function workFinishedAt(completedAt: string | null | undefined, allApprovedAt: string | null | undefined): string | null {
  const times = [toTime(completedAt), toTime(allApprovedAt)].filter((t): t is number => t !== null)
  return times.length ? new Date(Math.min(...times)).toISOString() : null
}

/** Marka hatırlatmalarının başlangıcı: ödeme vadesi ile işin bitişinden geç olanı. İş bitmediyse null. */
export function paymentReminderBase(paymentDueDate: string | null | undefined, finishedAt: string | null | undefined): string | null {
  const finished = toTime(finishedAt)
  if (finished === null) return null
  const due = toTime(paymentDueDate)
  return new Date(due === null ? finished : Math.max(due, finished)).toISOString()
}

/**
 * Sıradaki hatırlatma adımı. Ulaşılan en büyük adım gönderilmemişse onu döner (geç kalan görev eski adımları tek tek
 * göndermez; yalnızca güncel olanı). Daha büyük ya da aynı adım gönderildiyse null.
 */
export function dueReminderStep(base: string | null, now: Date, steps: readonly number[], sentSteps: readonly number[]): number | null {
  const start = toTime(base)
  if (start === null) return null
  const reached = steps.filter((d) => now.getTime() >= start + d * DAY_MS)
  if (!reached.length) return null
  const top = Math.max(...reached)
  if (sentSteps.some((s) => s >= top)) return null
  return top
}

export function paymentProgress(
  payment: { brand_paid_at: string | null; influencer_received_at: string | null } | null,
  finishedAt: string | null,
): PaymentProgress {
  if (payment?.brand_paid_at && payment?.influencer_received_at) return 'confirmed'
  if (payment?.brand_paid_at) return 'awaiting_influencer'
  if (payment?.influencer_received_at) return 'confirmed'
  return finishedAt ? 'awaiting_brand' : 'none'
}

/** Ödeme vadesinde mi (ödeme tarihi vade gününde ya da önce). Vade yoksa null (sayılmaz). */
export function isPaymentOnTime(paidDate: string | null | undefined, dueDate: string | null | undefined): boolean | null {
  const due = toTime(dueDate)
  const paid = toTime(paidDate)
  if (due === null || paid === null) return null
  return paid <= due
}

/** Teslimat tarihinde mi: onay ya da yayın günü teslim gününde ya da önce. Tarih yoksa null (sayılmaz). */
export function isDeliveryOnTime(d: { due_date: string | null; approved_at: string | null; published_at: string | null }): boolean | null {
  const due = parseDueDate(d.due_date)
  if (!due) return null
  const doneAt = [toTime(d.approved_at), toTime(d.published_at)].filter((t): t is number => t !== null)
  if (!doneAt.length) return null
  // Teslim günü Türkiye saatiyle (UTC+3) gün sonuna kadar sayılır.
  return istanbulDate(Math.min(...doneAt)) <= due
}

/** Zaman damgasının Türkiye (UTC+3, yaz saati yok) takvim günü: YYYY-AA-GG. */
export function istanbulDate(time: number | Date): string {
  const t = typeof time === 'number' ? time : time.getTime()
  return new Date(t + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** "Teslim edilmedi" bildirimi açık mı: teslim tarihi + ek süre geçti, teslimat onaylanmadı / yayınlanmadı. */
export function nondeliveryAvailableAt(d: { due_date: string | null; status: string }): string | null {
  const due = toTime(d.due_date)
  if (due === null || d.status === 'approved' || d.status === 'published') return null
  return new Date(due + (NONDELIVERY_GRACE_DAYS + 1) * DAY_MS).toISOString()
}

export interface PaymentBadgeStats {
  /** İki tarafça teyitli ödemesi olan iş birliği sayısı. */
  confirmed: number
  /** Bunlardan vadesi olan ve vadesinde ödenen. */
  onTime: number
  /** Vadesi olanlar (oran paydası). */
  withDueDate: number
  upheldDisputes: number
}

export interface DeliveryBadgeStats {
  completed: number
  onTime: number
  withDueDate: number
  upheldDisputes: number
}

const ratioOk = (onTime: number, total: number, min: number) => total > 0 && onTime / total >= min

export function onTimePaymentEligible(s: PaymentBadgeStats): boolean {
  const r = TRUST_BADGE_RULES.onTimePayment
  return s.confirmed >= r.minCollaborations && s.withDueDate >= r.minCollaborations && ratioOk(s.onTime, s.withDueDate, r.minOnTimeRatio) && s.upheldDisputes === 0
}

export function onTimeDeliveryEligible(s: DeliveryBadgeStats): boolean {
  const r = TRUST_BADGE_RULES.onTimeDelivery
  return s.completed >= r.minCompleted && s.withDueDate > 0 && ratioOk(s.onTime, s.withDueDate, r.minOnTimeRatio) && s.upheldDisputes === 0
}

/** Güvenilirlik bloğundaki sayısal satır (kaynaklı, yalnızca sayım). */
export function lateCountText(kind: 'payment' | 'delivery', late: number, total: number): string {
  if (total === 0) return kind === 'payment' ? 'Vadeli ödeme kaydı yok' : 'Tarihli teslimat kaydı yok'
  return kind === 'payment' ? `${total} vadeli ödemeden ${late} tanesi gecikti` : `${total} tarihli teslimattan ${late} tanesi gecikti`
}

export function proofExtension(value: unknown): (typeof DISPUTE_PROOF_EXTENSIONS)[number] | null {
  const ext = String(value ?? '').toLowerCase().replace(/^\./, '')
  const normalized = ext === 'jpeg' ? 'jpg' : ext
  return (DISPUTE_PROOF_EXTENSIONS as readonly string[]).includes(normalized) ? (normalized as (typeof DISPUTE_PROOF_EXTENSIONS)[number]) : null
}

/** Marka "Ödeme teyit edilmedi" başvurusunun dekont yolu: {marka}/claim-{iş birliği}/{zaman}.{uzantı}. */
export function isOwnClaimProofPath(userId: string, collaborationId: string, path: unknown): path is string {
  if (typeof path !== 'string') return false
  const parts = path.split('/')
  return parts.length === 3 && parts[0] === userId && parts[1] === `claim-${collaborationId}` && /^\d{10,16}\.(pdf|jpg|png|webp)$/.test(parts[2])
}

/** Kanıt dosyası yolu: {kullanıcı}/{anlaşmazlık}/{zaman}.{uzantı} biçiminde olmalı. */
export function isOwnProofPath(userId: string, disputeId: string, path: unknown): path is string {
  if (typeof path !== 'string') return false
  const parts = path.split('/')
  return parts.length === 3 && parts[0] === userId && parts[1] === disputeId && /^\d{10,16}\.(pdf|jpg|png|webp)$/.test(parts[2])
}
