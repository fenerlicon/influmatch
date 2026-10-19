// Görevler (2026-10-18, docs/ROADMAP.md "Görevler"): sunucu ve tarayıcı ortak sabitleri ve saf kuralları (gizli bilgi yok).
// Mobil karşılığı: mobile-app/constants/tasks.js (etiketler aynı tutulur; tests/mobile-parity.test.ts denetler).
//
// Akış: admin görev açar → kullanıcı kanıt gönderir (gönderi linki / story ekran görüntüsü / otomatik koşul) → sistem ölçer →
// admin onaylar → ödül "bekleyen ödül" olur → satış (POS) başlayınca admin hesaplara işler.

export type TaskKind = 'promo_video' | 'story_link' | 'invites' | 'creator_first_collab' | 'brand_first_steps' | 'brand_first_collab'
export type TaskAudience = 'creator' | 'brand'
export type TaskRewardType = 'spotlight_days' | 'discount_percent'
export type TaskRewardPlan = 'basic' | 'pro'
export type TaskSubmissionStatus = 'measuring' | 'in_review' | 'approved' | 'rejected'
export type TaskRewardStatus = 'pending' | 'applied' | 'cancelled'
/** Kullanıcının göndermesi gereken kanıt. */
export type TaskEvidence = 'post_url' | 'proof_image' | 'auto'

export const TASK_KINDS: TaskKind[] = ['promo_video', 'story_link', 'invites', 'creator_first_collab', 'brand_first_steps', 'brand_first_collab']

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  promo_video: 'Tanıtım videosu',
  story_link: 'Davet bağlantılı story',
  invites: 'Doğrulanmış davetler',
  creator_first_collab: 'Profil + ilk iş birliği',
  brand_first_steps: 'İlk ilan + teklifler',
  brand_first_collab: 'İlk tamamlanan iş birliği',
}

export const TASK_KIND_AUDIENCE: Record<TaskKind, TaskAudience> = {
  promo_video: 'creator',
  story_link: 'creator',
  invites: 'creator',
  creator_first_collab: 'creator',
  brand_first_steps: 'brand',
  brand_first_collab: 'brand',
}

export const TASK_KIND_EVIDENCE: Record<TaskKind, TaskEvidence> = {
  promo_video: 'post_url',
  story_link: 'proof_image',
  invites: 'auto',
  creator_first_collab: 'auto',
  brand_first_steps: 'auto',
  brand_first_collab: 'auto',
}

export const TASK_AUDIENCE_LABELS: Record<TaskAudience, string> = { creator: 'Influencer / UGC', brand: 'Marka' }

export const TASK_SUBMISSION_STATUS_LABELS: Record<TaskSubmissionStatus, string> = {
  measuring: 'Ölçülüyor',
  in_review: 'İncelemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
}

export const TASK_REWARD_STATUS_LABELS: Record<TaskRewardStatus, string> = {
  pending: 'Satış başlayınca',
  applied: 'Hesaba işlendi',
  cancelled: 'İptal edildi',
}

/** Görev kartındaki durum etiketi ve rengi (web ve mobil aynı). */
export const TASK_STATE_CHIPS: Record<'available' | 'ready' | 'measuring' | 'in_review' | 'completed' | 'blocked', { label: string; tone: 'neutral' | 'gold' | 'info' | 'success' }> = {
  available: { label: 'Açık', tone: 'neutral' },
  ready: { label: 'Ödül hazır', tone: 'gold' },
  measuring: { label: 'Ölçülüyor', tone: 'info' },
  in_review: { label: 'İncelemede', tone: 'info' },
  completed: { label: 'Tamamlandı', tone: 'success' },
  blocked: { label: 'Kilitli', tone: 'neutral' },
}

export const TASK_PLAN_LABELS: Record<TaskRewardPlan, string> = { basic: 'Basic', pro: 'Pro' }

/** Tanıtım videosu varsayılanları (admin görev parametresiyle değiştirir). */
export const PROMO_VIDEO_DEFAULTS = { view_ratio: 0.1, min_views: 500, hold_days: 7 } as const
export const INVITES_DEFAULTS = { per_round: 3 } as const
export const BRAND_FIRST_STEPS_DEFAULTS = { adverts: 1, offers: 3 } as const

export const TASK_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMax: 2000,
  reviewNoteMax: 500,
  maxRounds: 10,
  maxRewardDays: 365,
  maxRewardPercent: 90,
  maxTargets: 1000,
} as const

/** Görev kanıtı (story ekran görüntüsü) için izin verilen uzantılar; en fazla 5 MB. */
export const TASK_PROOF_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const
export const TASK_PROOF_MAX_BYTES = 5 * 1024 * 1024
export const TASK_PROOF_BUCKET = 'task-proofs'

export interface TaskParams {
  view_ratio?: number
  min_views?: number
  hold_days?: number
  per_round?: number
  adverts?: number
  offers?: number
}

export interface TaskRow {
  id: string
  kind: TaskKind
  audience: TaskAudience
  title: string
  description: string
  reward_type: TaskRewardType
  reward_plan: TaskRewardPlan | null
  reward_days: number | null
  reward_percent: number | null
  max_rounds: number
  params: TaskParams
  target_user_ids: string[] | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export const TASK_COLUMNS =
  'id, kind, audience, title, description, reward_type, reward_plan, reward_days, reward_percent, max_rounds, params, target_user_ids, is_active, starts_at, ends_at, sort_order, created_at, updated_at'

export const SUBMISSION_COLUMNS =
  'id, task_id, user_id, round, status, post_url, platform, proof_path, followers_at_submit, required_views, measure_due_at, measured_views, measured_likes, measured_at, measure_fail_count, has_ad_tag, check_note, review_note, reviewed_at, created_at'

export const REWARD_COLUMNS =
  'id, submission_id, user_id, reward_type, reward_plan, reward_days, reward_percent, code, status, applied_at, applied_plan, applied_until, created_at'

/** Rol → görev kitlesi (admin görev görmez). */
export function audienceForRole(role: string | null | undefined): TaskAudience | null {
  if (role === 'influencer') return 'creator'
  if (role === 'brand') return 'brand'
  return null
}

/** Görev şu an açık mı (aktif ve tarih aralığında). */
export function isTaskOpen(task: Pick<TaskRow, 'is_active' | 'starts_at' | 'ends_at'>, now = Date.now()): boolean {
  if (!task.is_active) return false
  if (task.starts_at && Date.parse(task.starts_at) > now) return false
  if (task.ends_at && Date.parse(task.ends_at) <= now) return false
  return true
}

/** Görev bu kullanıcıya mı (hedef listesi boşsa kitlenin tamamı). */
export function isTaskTargeted(task: Pick<TaskRow, 'target_user_ids'>, userId: string): boolean {
  return !task.target_user_ids || task.target_user_ids.length === 0 || task.target_user_ids.includes(userId)
}

const positiveNumber = (value: unknown, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Tanıtım videosu için gereken izlenme: takipçinin oranı, en az alt sınır. */
export function requiredPromoViews(followers: number | null | undefined, params: TaskParams = {}): number {
  const ratio = positiveNumber(params.view_ratio, PROMO_VIDEO_DEFAULTS.view_ratio)
  const min = Math.round(positiveNumber(params.min_views, PROMO_VIDEO_DEFAULTS.min_views))
  const base = typeof followers === 'number' && followers > 0 ? Math.ceil(followers * ratio) : 0
  return Math.max(min, base)
}

export function promoHoldDays(params: TaskParams = {}): number {
  return Math.round(positiveNumber(params.hold_days, PROMO_VIDEO_DEFAULTS.hold_days))
}

/** Gönderi metninde ödüllü paylaşım etiketi var mı (#reklam, #işbirliği, #isbirligi, #iş_birliği). */
export function hasAdTag(caption: string | null | undefined): boolean {
  if (!caption) return false
  const text = caption
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return /#(reklam|isbirligi|is_birligi|sponsorlu)(?![a-z0-9_])/.test(text)
}

/** Otomatik görevlerin ilerlemesini hesaplamak için sunucunun topladığı sayılar. */
export interface TaskFacts {
  verifiedInvites: number
  profilePercent: number
  hasRatePrice: boolean
  completedCollabs: number
  adverts: number
  offersSent: number
}

export interface TaskProgressItem {
  label: string
  current: number
  target: number
  met: boolean
}

/** Otomatik görevde bu tur için koşullar (tur: 1'den başlar; davet görevinde her tur `per_round` davet ister). */
export function autoTaskProgress(kind: TaskKind, facts: TaskFacts, round: number, params: TaskParams = {}): TaskProgressItem[] {
  const item = (label: string, current: number, target: number): TaskProgressItem => ({
    label,
    current: Math.min(current, target),
    target,
    met: current >= target,
  })
  switch (kind) {
    case 'invites': {
      const perRound = Math.round(positiveNumber(params.per_round, INVITES_DEFAULTS.per_round))
      return [item('Doğrulanmış davet', facts.verifiedInvites, perRound * Math.max(1, round))]
    }
    case 'creator_first_collab':
      return [
        item('Profil doluluğu (%)', facts.profilePercent, 100),
        item('Fiyat kartında fiyat', facts.hasRatePrice ? 1 : 0, 1),
        item('Tamamlanan iş birliği', facts.completedCollabs, 1),
      ]
    case 'brand_first_steps': {
      const adverts = Math.round(positiveNumber(params.adverts, BRAND_FIRST_STEPS_DEFAULTS.adverts))
      const offers = Math.round(positiveNumber(params.offers, BRAND_FIRST_STEPS_DEFAULTS.offers))
      return [item('Açılan ilan', facts.adverts, adverts), item('Gönderilen teklif', facts.offersSent, offers)]
    }
    case 'brand_first_collab':
      return [item('Tamamlanan iş birliği', facts.completedCollabs, 1)]
    default:
      return []
  }
}

/** Ödülün kısa metni: "+30 gün Spotlight Pro" / "%20 indirim kodu". */
export function rewardText(r: { reward_type: TaskRewardType; reward_plan: TaskRewardPlan | null; reward_days: number | null; reward_percent: number | null }): string {
  if (r.reward_type === 'spotlight_days') {
    return `+${r.reward_days ?? 0} gün Spotlight ${TASK_PLAN_LABELS[r.reward_plan ?? 'basic']}`
  }
  return `%${r.reward_percent ?? 0} indirim kodu`
}

/** Rol + ödül planı → Spotlight plan kodu. */
export function spotlightPlanCode(role: string | null | undefined, plan: TaskRewardPlan): 'ibasic' | 'ipro' | 'mbasic' | 'mpro' | null {
  if (role === 'brand') return plan === 'pro' ? 'mpro' : 'mbasic'
  if (role === 'influencer') return plan === 'pro' ? 'ipro' : 'ibasic'
  return null
}

const PLAN_RANK: Record<string, number> = { ibasic: 1, mbasic: 1, ipro: 2, mpro: 2 }

/**
 * Spotlight süre ödülünün hesaba etkisi: plan, mevcut aktif plan ile ödülün yükseği; bitiş, mevcut aktif bitişten (yoksa şimdiden)
 * ödül gün sayısı kadar sonra. Süresiz aktif plana dokunulmaz (null döner).
 */
export function applySpotlightReward(
  current: { spotlight_active: boolean | null; spotlight_plan: string | null; spotlight_expires_at: string | null },
  rewardPlanCode: 'ibasic' | 'ipro' | 'mbasic' | 'mpro',
  days: number,
  now = Date.now(),
): { plan: 'ibasic' | 'ipro' | 'mbasic' | 'mpro'; expiresAt: string } | null {
  const active = !!current.spotlight_active && (!current.spotlight_expires_at || Date.parse(current.spotlight_expires_at) > now)
  if (active && !current.spotlight_expires_at) return null
  const currentPlan = active && current.spotlight_plan && PLAN_RANK[current.spotlight_plan] ? current.spotlight_plan : null
  const plan = (currentPlan && PLAN_RANK[currentPlan] > PLAN_RANK[rewardPlanCode] ? currentPlan : rewardPlanCode) as
    | 'ibasic'
    | 'ipro'
    | 'mbasic'
    | 'mpro'
  const base = active && current.spotlight_expires_at ? Math.max(now, Date.parse(current.spotlight_expires_at)) : now
  return { plan, expiresAt: new Date(base + days * 24 * 60 * 60 * 1000).toISOString() }
}

/** Admin formu girdisi (yeni görev ya da düzenleme). */
export interface TaskInput {
  kind?: unknown
  title?: unknown
  description?: unknown
  rewardType?: unknown
  rewardPlan?: unknown
  rewardDays?: unknown
  rewardPercent?: unknown
  maxRounds?: unknown
  params?: unknown
  targetUserIds?: unknown
  isActive?: unknown
  startsAt?: unknown
  endsAt?: unknown
  sortOrder?: unknown
}

export type TaskFields = Omit<TaskRow, 'id' | 'created_at' | 'updated_at'>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && Number.isInteger(n) ? n : NaN
}

function dateOrNull(value: unknown): string | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  const t = Date.parse(String(value))
  return Number.isFinite(t) ? new Date(t).toISOString() : 'invalid'
}

/** Görev parametreleri: yalnızca görev türünün kullandığı alanlar, makul aralıkta. */
function cleanParams(kind: TaskKind, raw: unknown): TaskParams | { error: string } {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const num = (key: string, min: number, max: number, fallback: number) => {
    const v = p[key]
    if (v === undefined || v === null || v === '') return fallback
    const n = Number(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= min && n <= max ? n : NaN
  }
  if (kind === 'promo_video') {
    const view_ratio = num('view_ratio', 0.01, 1, PROMO_VIDEO_DEFAULTS.view_ratio)
    const min_views = num('min_views', 0, 10_000_000, PROMO_VIDEO_DEFAULTS.min_views)
    const hold_days = num('hold_days', 1, 60, PROMO_VIDEO_DEFAULTS.hold_days)
    if ([view_ratio, min_views, hold_days].some(Number.isNaN)) {
      return { error: 'İzlenme oranı 0,01–1, en az izlenme 0–10.000.000, bekleme 1–60 gün olmalı.' }
    }
    return { view_ratio, min_views: Math.round(min_views), hold_days: Math.round(hold_days) }
  }
  if (kind === 'invites') {
    const per_round = num('per_round', 1, 100, INVITES_DEFAULTS.per_round)
    if (Number.isNaN(per_round)) return { error: 'Tur başına davet 1–100 olmalı.' }
    return { per_round: Math.round(per_round) }
  }
  if (kind === 'brand_first_steps') {
    const adverts = num('adverts', 0, 50, BRAND_FIRST_STEPS_DEFAULTS.adverts)
    const offers = num('offers', 0, 200, BRAND_FIRST_STEPS_DEFAULTS.offers)
    if (Number.isNaN(adverts) || Number.isNaN(offers)) return { error: 'İlan 0–50, teklif 0–200 olmalı.' }
    return { adverts: Math.round(adverts), offers: Math.round(offers) }
  }
  return {}
}

/** Admin formunu doğrular; geçerliyse tabloya yazılacak alanlar döner. */
export function validateTaskInput(input: TaskInput): TaskFields | { error: string } {
  const kind = input.kind as TaskKind
  if (!TASK_KINDS.includes(kind)) return { error: 'Görev türü geçersiz.' }

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (title.length < TASK_LIMITS.titleMin || title.length > TASK_LIMITS.titleMax) {
    return { error: `Başlık ${TASK_LIMITS.titleMin}–${TASK_LIMITS.titleMax} karakter olmalı.` }
  }
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > TASK_LIMITS.descriptionMax) return { error: `Açıklama en fazla ${TASK_LIMITS.descriptionMax} karakter olabilir.` }

  const rewardType = input.rewardType as TaskRewardType
  if (rewardType !== 'spotlight_days' && rewardType !== 'discount_percent') return { error: 'Ödül türü geçersiz.' }
  let reward_plan: TaskRewardPlan | null = null
  let reward_days: number | null = null
  let reward_percent: number | null = null
  if (rewardType === 'spotlight_days') {
    if (input.rewardPlan !== 'basic' && input.rewardPlan !== 'pro') return { error: 'Spotlight paketi seçin (Basic / Pro).' }
    reward_plan = input.rewardPlan
    const days = intOrNull(input.rewardDays)
    if (days === null || Number.isNaN(days) || days < 1 || days > TASK_LIMITS.maxRewardDays) {
      return { error: `Ödül süresi 1–${TASK_LIMITS.maxRewardDays} gün olmalı.` }
    }
    reward_days = days
  } else {
    const percent = intOrNull(input.rewardPercent)
    if (percent === null || Number.isNaN(percent) || percent < 1 || percent > TASK_LIMITS.maxRewardPercent) {
      return { error: `İndirim %1–%${TASK_LIMITS.maxRewardPercent} olmalı.` }
    }
    reward_percent = percent
  }

  const rounds = intOrNull(input.maxRounds)
  const max_rounds = rounds === null ? 1 : rounds
  if (Number.isNaN(max_rounds) || max_rounds < 1 || max_rounds > TASK_LIMITS.maxRounds) {
    return { error: `Tekrar sayısı 1–${TASK_LIMITS.maxRounds} olmalı.` }
  }

  const params = cleanParams(kind, input.params)
  if ('error' in params) return params

  let target_user_ids: string[] | null = null
  const rawTargets = Array.isArray(input.targetUserIds)
    ? input.targetUserIds
    : typeof input.targetUserIds === 'string'
      ? input.targetUserIds.split(/[\s,;]+/)
      : []
  const targets = Array.from(new Set(rawTargets.map((v) => String(v).trim()).filter(Boolean)))
  if (targets.length) {
    if (targets.some((id) => !UUID_RE.test(id))) return { error: 'Hedef kullanıcılar geçerli kullanıcı ID\'leri olmalı (virgülle ayırın).' }
    if (targets.length > TASK_LIMITS.maxTargets) return { error: `En fazla ${TASK_LIMITS.maxTargets} hedef kullanıcı.` }
    target_user_ids = targets.map((id) => id.toLowerCase())
  }

  const starts_at = dateOrNull(input.startsAt)
  const ends_at = dateOrNull(input.endsAt)
  if (starts_at === 'invalid' || ends_at === 'invalid') return { error: 'Tarih geçersiz.' }
  if (starts_at && ends_at && Date.parse(ends_at) <= Date.parse(starts_at)) return { error: 'Bitiş, başlangıçtan sonra olmalı.' }

  const sort = intOrNull(input.sortOrder)
  const sort_order = sort === null || Number.isNaN(sort) ? 0 : Math.max(-1000, Math.min(1000, sort))

  return {
    kind,
    audience: TASK_KIND_AUDIENCE[kind],
    title,
    description,
    reward_type: rewardType,
    reward_plan,
    reward_days,
    reward_percent,
    max_rounds,
    params,
    target_user_ids,
    is_active: input.isActive === true,
    starts_at,
    ends_at,
    sort_order,
  }
}
