// İlan ekranlarının ortak tipleri ve biçimlendiricileri (sunucu + istemci). Gizli bilgi yok.
import type { ChipTone } from '@/components/ui'

export type AdvertPaymentType = 'cash' | 'barter' | 'other'

export interface AdvertQuestion {
  id: string
  type: 'text' | 'single_select' | 'multiple_choice'
  question: string
  options?: string[]
  /** Yanıt zorunlu mu (alan yoksa zorunlu sayılır; marka formunda varsayılan açık). */
  required?: boolean
}

/** Başvurudaki tek bir soru yanıtı. Soru metni başvuru anında kopyalanır (marka soruyu sonra değiştirse de görünen aynı kalır). */
export interface AdvertAnswer {
  id: string
  question: string
  type: AdvertQuestion['type']
  answer: string | string[]
}

/** Başvuru formundan sunucuya giden yanıtlar: soru kimliği → metin ya da seçenek(ler). */
export type AdvertAnswerInput = Record<string, string | string[]>

export const ANSWER_MAX_LENGTH = 1000

export const isQuestionRequired = (q: Pick<AdvertQuestion, 'required'>) => q.required !== false

/** Yanıtın ekrandaki hali (çoklu seçim virgülle). */
export function formatAnswer(answer: AdvertAnswer['answer']): string {
  return Array.isArray(answer) ? answer.join(', ') : answer
}

/** jsonb'den gelen yanıtlar (bozuk satırlar atlanır). */
export function parseAnswers(value: unknown): AdvertAnswer[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (a): a is AdvertAnswer =>
      !!a && typeof a === 'object' && typeof (a as AdvertAnswer).question === 'string' && (typeof (a as AdvertAnswer).answer === 'string' || Array.isArray((a as AdvertAnswer).answer)),
  )
}

export interface AdvertProject {
  id: string
  title: string
  summary: string
  category: string
  brandName: string
  brandAvatar: string | null
  brandUserId?: string | null
  brandDisplayedBadges?: string[] | null
  brandVerificationStatus?: string | null
  brandIsSpotlight?: boolean
  budgetCurrency: string
  budgetMin: number | null
  budgetMax: number | null
  deliverables: string[]
  platforms: string[]
  location: string
  heroImage: string | null
  deadline: string | null
  status: string
  createdAt: string
  paymentType?: AdvertPaymentType
  customQuestions?: AdvertQuestion[]
}

export type ApplicationStatus = 'pending' | 'shortlisted' | 'rejected' | 'accepted'

interface ApplicationParty {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  verification_status?: 'pending' | 'verified' | 'rejected' | null
  displayed_badges?: string[] | null
}

export interface AdvertApplication {
  id: string
  advert_id: string
  advert_title: string
  advert_category: string | null
  influencer: ApplicationParty
  brand?: ApplicationParty
  cover_letter: string | null
  deliverable_idea: string | null
  budget_expectation: number | null
  status: ApplicationStatus
  created_at: string
  room_id?: string | null
  has_messages?: boolean
  /** Kabul edilen başvurunun iş birliği (3.14-S1): listede aşama ve detay bağlantısı. */
  collaboration?: { id: string; status: 'agreed' | 'in_progress' | 'published' | 'completed' | 'cancelled' } | null
  /** Markanın sorularına verilen yanıtlar (3.7-S6). */
  answers?: AdvertAnswer[]
}

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: ChipTone }> = {
  pending: { label: 'Bekliyor', tone: 'warning' },
  shortlisted: { label: 'Ön listede', tone: 'info' },
  accepted: { label: 'Kabul edildi', tone: 'success' },
  rejected: { label: 'Olumsuz', tone: 'neutral' },
}

export const ADVERT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  open: { label: 'Yayında', tone: 'success' },
  paused: { label: 'Duraklatıldı', tone: 'warning' },
  closed: { label: 'Kapandı', tone: 'neutral' },
}

export const PAYMENT_LABELS: Record<AdvertPaymentType, string> = {
  cash: 'Nakit',
  barter: 'Barter',
  other: 'Diğer',
}

const money = (value: number, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY', maximumFractionDigits: 0 }).format(value)

/** "₺5.000–8.000", "₺10.000", "Barter" veya "Bütçe belirtilmedi". */
export function formatAdvertBudget(project: Pick<AdvertProject, 'budgetMin' | 'budgetMax' | 'budgetCurrency' | 'paymentType'>) {
  const { budgetMin: min, budgetMax: max, budgetCurrency: currency } = project
  if (min === null && max === null) return project.paymentType === 'barter' ? 'Barter' : 'Bütçe belirtilmedi'
  if (min !== null && max !== null && min !== max) return `${money(min, currency)}–${money(max, currency).replace(/^[^\d]+/, '')}`
  return money((min ?? max) as number, currency)
}

/** Başvurudaki bütçe beklentisi (0 = barter). */
export function formatExpectation(value: number | null) {
  if (value === null || value === undefined) return null
  if (Number(value) === 0) return 'Barter'
  return money(Number(value))
}

export function formatDay(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(date)
}

/** "Bugün", "Dün", "3 gün önce", "2 hafta önce", "4 ay önce". */
export function relativeDay(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (days <= 0) return 'Bugün'
  if (days === 1) return 'Dün'
  if (days < 7) return `${days} gün önce`
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`
  return `${Math.floor(days / 30)} ay önce`
}

/** Son başvuru günü geçti mi (gün dahil, Türkiye saati; sunucu ve DB de aynı kuralı uygular). */
export function isPastDeadline(deadline: string | null) {
  if (!deadline) return false
  return deadline.slice(0, 10) < new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}
