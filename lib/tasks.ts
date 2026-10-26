// Görevler (2026-10-18, docs/ROADMAP.md "Görevler"; SYSTEM_MAP 3.21).
//   - Admin görev açar (/admin/tasks). Kullanıcı görevi Görevler sayfasından (web /dashboard/tasks, mobil Görevler ekranı) gönderir.
//   - Tanıtım videosu: gönderi linki → hold_days sonra saatlik görev Apify ile izlenmeyi ölçer (eşik: takipçinin oranı, en az alt sınır);
//     eşiği geçen incelemeye düşer, geçemeyen reddedilir. Story: ekran görüntüsü → doğrudan inceleme. Otomatik görevler: koşullar sağlanınca
//     kullanıcı "Ödülü talep et" der, sunucu koşulları yeniden kontrol edip incelemeye alır.
//   - Her ödül admin onayından geçer (sahte etkileşime karşı). Onaylanan ödül "bekleyen ödül"dür; satış (POS) başlayınca admin
//     "Ödülleri hesaplara işle" ile Spotlight sürelerini ekler, indirim kodlarını kullanılabilir yapar.
//   - Görev tabloları istemci rollerine kapalıdır: okuma ve yazma yalnızca bu dosyadan (service role), çağıran taraf kullanıcıyı doğrular.
//
// Kişisel veri dışarı gönderilmez: Apify'a yalnızca herkese açık gönderi bağlantısı gider (CLAUDE.md kural 1).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { ApiRequestError } from '@/lib/api-keys'
import { fetchPostMetrics, isMeasurablePostUrl, platformOfUrl } from '@/lib/post-metrics'
import { notifyUser } from '@/lib/notify'
import { syncBlueTick } from '@/lib/blue-tick'
import { countInvites, ensureInviteCode, inviteLink } from '@/lib/invites'
import { loadBlueTickPromo, loadPromoPeriod } from '@/lib/tasks-promo'
import type { BlueTickPromo } from '@/lib/blue-tick-rules'
import { calculateProfileCompletion } from '@/utils/profileCompletion'
import { formatReason, loadUserDecisions, parseDecisionReason, recordDecision, type DecisionReasonInput, type DecisionView } from '@/lib/moderation'
import {
  REWARD_COLUMNS,
  SUBMISSION_COLUMNS,
  TASK_COLUMNS,
  TASK_KIND_EVIDENCE,
  TASK_LIMITS,
  TASK_PROOF_BUCKET,
  TASK_PROOF_EXTENSIONS,
  TASK_REWARD_STATUS_LABELS,
  TASK_SUBMISSION_STATUS_LABELS,
  applySpotlightReward,
  audienceForRole,
  autoTaskProgress,
  hasAdTag,
  isTaskOpen,
  isTaskTargeted,
  promoHoldDays,
  requiredPromoViews,
  rewardText,
  spotlightPlanCode,
  validateTaskInput,
  type TaskAudience,
  type TaskEvidence,
  type TaskFacts,
  type TaskInput,
  type TaskKind,
  type TaskProgressItem,
  type TaskRewardStatus,
  type TaskRow,
  type TaskSubmissionStatus,
} from '@/lib/tasks-shared'

export * from '@/lib/tasks-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { success: false; error: string }

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

/** Ölçüme ulaşılamazsa bu kadar sonra yeniden denenir; 3 başarısızlıkta reddedilir. */
const MEASURE_RETRY_MS = 6 * HOUR_MS
const MEASURE_MAX_FAILURES = 3
const CRON_BATCH_LIMIT = 10
const TASKS_LINK = '/dashboard/tasks'

interface SubmissionRow {
  id: string
  task_id: string
  user_id: string
  round: number
  status: TaskSubmissionStatus
  post_url: string | null
  platform: 'instagram' | 'tiktok' | null
  proof_path: string | null
  followers_at_submit: number | null
  required_views: number | null
  measure_due_at: string | null
  measured_views: number | null
  measured_likes: number | null
  measured_at: string | null
  measure_fail_count: number
  has_ad_tag: boolean | null
  check_note: string | null
  review_note: string | null
  reviewed_at: string | null
  created_at: string
}

interface RewardRow {
  id: string
  submission_id: string
  user_id: string
  reward_type: TaskRow['reward_type']
  reward_plan: TaskRow['reward_plan']
  reward_days: number | null
  reward_percent: number | null
  code: string | null
  status: TaskRewardStatus
  applied_at: string | null
  applied_plan: string | null
  applied_until: string | null
  created_at: string
}

// --- Kullanıcı görünümü ---------------------------------------------------------------------------

export interface TaskSubmissionView {
  id: string
  round: number
  status: TaskSubmissionStatus
  statusLabel: string
  postUrl: string | null
  measureDueAt: string | null
  measuredViews: number | null
  requiredViews: number | null
  checkNote: string | null
  reviewNote: string | null
  createdAt: string
  /** Admin reddi ise karar + itiraz durumu (yalnızca kullanıcı görünümünde, en son gönderim için). */
  decision?: DecisionView | null
}

export type TaskState = 'available' | 'ready' | 'measuring' | 'in_review' | 'completed' | 'blocked'

export interface TaskView {
  id: string
  kind: TaskKind
  title: string
  description: string
  reward: string
  evidence: TaskEvidence
  maxRounds: number
  approvedRounds: number
  /** Gönderilecek tur (hepsi bittiyse null). */
  nextRound: number | null
  state: TaskState
  blockedReason: string | null
  progress: TaskProgressItem[]
  /** Tanıtım videosu: bu kullanıcı için gereken izlenme ve bekleme süresi. */
  requiredViews: number | null
  holdDays: number | null
  endsAt: string | null
  latest: TaskSubmissionView | null
}

export interface TaskRewardView {
  id: string
  taskTitle: string
  text: string
  status: TaskRewardStatus
  statusLabel: string
  /** İndirim kodu (satış başlayınca kullanılır). */
  code: string | null
  appliedUntil: string | null
  createdAt: string
}

export interface TasksOverview {
  audience: TaskAudience
  promoPeriod: boolean
  verified: boolean
  invite: { code: string; link: string; total: number; verified: number } | null
  tasks: TaskView[]
  rewards: TaskRewardView[]
}

function submissionView(row: SubmissionRow): TaskSubmissionView {
  return {
    id: row.id,
    round: row.round,
    status: row.status,
    statusLabel: TASK_SUBMISSION_STATUS_LABELS[row.status],
    postUrl: row.post_url,
    measureDueAt: row.measure_due_at,
    measuredViews: row.measured_views,
    requiredViews: row.required_views,
    checkNote: row.check_note,
    reviewNote: row.review_note,
    createdAt: row.created_at,
  }
}

function adminOrError(admin: SupabaseClient | null): SupabaseClient {
  if (!admin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
  return admin
}

interface ViewerRow {
  id: string
  role: string | null
  verification_status: string | null
  full_name: string | null
  username: string | null
  city: string | null
  bio: string | null
  category: string | null
  avatar_url: string | null
  social_links: Record<string, string | null> | null
}

async function loadViewer(admin: SupabaseClient, userId: string): Promise<ViewerRow | null> {
  const { data } = await admin
    .from('users')
    .select('id, role, verification_status, full_name, username, city, bio, category, avatar_url, social_links')
    .eq('id', userId)
    .maybeSingle()
  return (data as ViewerRow | null) ?? null
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string) {
  const { count, error } = await query
  if (error) console.error(`[tasks] ${label} sayılamadı:`, error.message)
  return count ?? 0
}

/** Otomatik görev koşulları için sayılar (yalnızca rolün görevlerinin kullandıkları). */
async function loadFacts(admin: SupabaseClient, viewer: ViewerRow): Promise<TaskFacts> {
  const facts: TaskFacts = { verifiedInvites: 0, profilePercent: 0, hasRatePrice: false, completedCollabs: 0, adverts: 0, offersSent: 0 }
  if (viewer.role === 'brand') {
    const [adverts, offers, collabs] = await Promise.all([
      countRows(admin.from('advert_projects').select('id', { count: 'exact', head: true }).eq('brand_id', viewer.id), 'ilanlar'),
      countRows(admin.from('offers').select('id', { count: 'exact', head: true }).eq('sender_user_id', viewer.id), 'teklifler'),
      countRows(
        admin.from('collaborations').select('id', { count: 'exact', head: true }).eq('brand_id', viewer.id).eq('status', 'completed'),
        'iş birlikleri',
      ),
    ])
    facts.adverts = adverts
    facts.offersSent = offers
    facts.completedCollabs = collabs
    return facts
  }
  const [invites, rateCard, collabs] = await Promise.all([
    countInvites(admin, viewer.id),
    admin.from('rate_cards').select('user_id').eq('user_id', viewer.id).maybeSingle(),
    countRows(
      admin.from('collaborations').select('id', { count: 'exact', head: true }).eq('influencer_id', viewer.id).eq('status', 'completed'),
      'iş birlikleri',
    ),
  ])
  facts.verifiedInvites = invites.verified
  // rate_cards satırı en az bir fiyat olmadan yazılamaz (rate_cards_has_price).
  facts.hasRatePrice = !!rateCard.data
  facts.completedCollabs = collabs
  facts.profilePercent = calculateProfileCompletion(viewer, 'influencer').percent
  return facts
}

/** Kullanıcının doğrulanmış Instagram / TikTok hesaplarındaki en yüksek takipçi (platform verilirse yalnızca o). */
async function verifiedFollowers(admin: SupabaseClient, userId: string, platform?: 'instagram' | 'tiktok'): Promise<number | null> {
  const query = admin
    .from('social_accounts')
    .select('follower_count')
    .eq('user_id', userId)
    .eq('is_verified', true)
    .in('platform', platform ? [platform] : ['instagram', 'tiktok'])
    .order('follower_count', { ascending: false, nullsFirst: false })
    .limit(1)
  const { data } = await query.maybeSingle()
  const n = Number(data?.follower_count)
  return data ? (Number.isFinite(n) && n >= 0 ? n : 0) : null
}

function liveFor(subs: SubmissionRow[], round: number) {
  return subs.find((s) => s.round === round && (s.status === 'measuring' || s.status === 'in_review')) ?? null
}

/** Görevler sayfası verisi (web + mobil). */
export async function getTasksOverviewAs(userId: string, adminClient: SupabaseClient | null = createSupabaseAdminClient()): Promise<Result<{ overview: TasksOverview }>> {
  try {
    const admin = adminOrError(adminClient)
    const viewer = await loadViewer(admin, userId)
    const audience = audienceForRole(viewer?.role)
    if (!viewer || !audience) return { success: false, error: 'Görevler yalnızca influencer, UGC ve marka hesaplarında.' }

    const [{ data: taskRows, error: taskError }, { data: subRows }, { data: rewardRows }, promoPeriod, facts] = await Promise.all([
      admin.from('platform_tasks').select(TASK_COLUMNS).eq('audience', audience).order('sort_order').order('created_at'),
      admin.from('task_submissions').select(SUBMISSION_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
      admin.from('task_rewards').select(REWARD_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      loadPromoPeriod(admin),
      loadFacts(admin, viewer),
    ])
    if (taskError) throw new Error(taskError.message)

    const subs = (subRows ?? []) as SubmissionRow[]
    const allTasks = (taskRows ?? []) as TaskRow[]
    const verified = viewer.verification_status === 'verified'
    const followers = audience === 'creator' ? await verifiedFollowers(admin, userId) : null
    const now = Date.now()

    // Açık ve hedeflenen görevler + kullanıcının daha önce gönderdiği (kapanmış olsa da sonucu görünsün).
    const touched = new Set(subs.map((s) => s.task_id))
    const tasks = allTasks.filter((t) => (isTaskOpen(t, now) && isTaskTargeted(t, userId)) || touched.has(t.id))

    const views: TaskView[] = tasks.map((task) => {
      const mine = subs.filter((s) => s.task_id === task.id)
      const approvedRounds = mine.filter((s) => s.status === 'approved').length
      const nextRound = approvedRounds < task.max_rounds ? approvedRounds + 1 : null
      const live = nextRound ? liveFor(mine, nextRound) : null
      const evidence = TASK_KIND_EVIDENCE[task.kind]
      const progress = evidence === 'auto' && nextRound ? autoTaskProgress(task.kind, facts, nextRound, task.params) : []
      const open = isTaskOpen(task, now) && isTaskTargeted(task, userId)

      let state: TaskState
      let blockedReason: string | null = null
      if (!nextRound) state = 'completed'
      else if (live) state = live.status === 'measuring' ? 'measuring' : 'in_review'
      else if (!open) {
        state = 'blocked'
        blockedReason = 'Bu görev şu an kapalı.'
      } else if (!verified) {
        state = 'blocked'
        blockedReason = 'Hesabın onaylandıktan sonra görev gönderebilirsin.'
      } else if (task.kind === 'promo_video' && followers === null) {
        state = 'blocked'
        blockedReason = 'Önce Instagram ya da TikTok hesabını doğrula.'
      } else if (evidence === 'auto') state = progress.every((p) => p.met) ? 'ready' : 'available'
      else state = 'available'

      return {
        id: task.id,
        kind: task.kind,
        title: task.title,
        description: task.description,
        reward: rewardText(task),
        evidence,
        maxRounds: task.max_rounds,
        approvedRounds,
        nextRound,
        state,
        blockedReason,
        progress,
        requiredViews: task.kind === 'promo_video' ? requiredPromoViews(followers, task.params) : null,
        holdDays: task.kind === 'promo_video' ? promoHoldDays(task.params) : null,
        endsAt: task.ends_at,
        latest: mine[0] ? submissionView(mine[0]) : null,
      }
    })

    // Admin reddedilen son gönderimlerin karar + itiraz durumu (tablo yoksa boş).
    const rejectedLatest = views.map((v) => v.latest).filter((l): l is TaskSubmissionView => !!l && l.status === 'rejected')
    if (rejectedLatest.length) {
      const { decisions } = await loadUserDecisions(admin, userId, { subjectType: 'task_submission', subjectIds: rejectedLatest.map((l) => l.id) })
      const bySubject = new Map(decisions.map((d) => [d.subjectId, d]))
      for (const l of rejectedLatest) l.decision = bySubject.get(l.id) ?? null
    }

    const titleOf = new Map(allTasks.map((t) => [t.id, t.title]))
    const taskOfSubmission = new Map(subs.map((s) => [s.id, s.task_id]))
    const rewards: TaskRewardView[] = ((rewardRows ?? []) as RewardRow[]).map((r) => ({
      id: r.id,
      taskTitle: titleOf.get(taskOfSubmission.get(r.submission_id) ?? '') ?? 'Görev',
      text: rewardText(r),
      status: r.status,
      statusLabel: TASK_REWARD_STATUS_LABELS[r.status],
      code: r.code,
      appliedUntil: r.applied_until,
      createdAt: r.created_at,
    }))

    let invite: TasksOverview['invite'] = null
    if (audience === 'creator' && tasks.some((t) => t.kind === 'invites' || t.kind === 'story_link')) {
      const code = await ensureInviteCode(admin, userId)
      if (code) {
        const counts = await countInvites(admin, userId)
        invite = { code, link: inviteLink(code), total: counts.total, verified: counts.verified }
      }
    }

    return { success: true, overview: { audience, promoPeriod, verified, invite, tasks: views, rewards } }
  } catch (error) {
    console.error('[tasks] görevler okunamadı:', error)
    return { success: false, error: 'Görevler yüklenemedi. Lütfen tekrar deneyin.' }
  }
}

// --- Gönderim -------------------------------------------------------------------------------------

const normalizeUrl = (url: string) => url.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^http:/i, 'https:').toLowerCase()

/** Story ekran görüntüsü için tek kullanımlık imzalı yükleme adresi (kova istemcilere kapalı). */
export async function createTaskProofUploadUrlAs(
  userId: string,
  extension: string,
  adminClient: SupabaseClient | null = createSupabaseAdminClient(),
): Promise<Result<{ path: string; token: string }>> {
  const ext = String(extension || '').toLowerCase()
  if (!TASK_PROOF_EXTENSIONS.includes(ext as (typeof TASK_PROOF_EXTENSIONS)[number])) {
    return { success: false, error: 'Yalnızca JPG, PNG veya WEBP görsel yükleyebilirsin.' }
  }
  try {
    const admin = adminOrError(adminClient)
    // Kötüye kullanıma karşı günde en fazla 10 yükleme.
    const { data: files } = await admin.storage.from(TASK_PROOF_BUCKET).list(userId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    const since = Date.now() - DAY_MS
    if ((files ?? []).filter((f) => f.created_at && Date.parse(f.created_at) >= since).length >= 10) {
      return { success: false, error: 'Günde en fazla 10 görsel yükleyebilirsin. Lütfen yarın tekrar dene.' }
    }
    const path = `${userId}/${Date.now()}.${ext}`
    const { data, error } = await admin.storage.from(TASK_PROOF_BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[tasks] yükleme adresi alınamadı:', error?.message)
      return { success: false, error: 'Yükleme başlatılamadı. Lütfen tekrar dene.' }
    }
    return { success: true, path: data.path, token: data.token }
  } catch (error) {
    console.error('[tasks] yükleme adresi alınamadı:', error)
    return { success: false, error: 'Yükleme başlatılamadı. Lütfen tekrar dene.' }
  }
}

async function proofExists(admin: SupabaseClient, userId: string, path: string) {
  const parts = path.split('/')
  if (parts.length !== 2 || parts[0] !== userId || !/^\d+\.(jpe?g|png|webp)$/i.test(parts[1])) return false
  const { data } = await admin.storage.from(TASK_PROOF_BUCKET).list(userId, { search: parts[1], limit: 5 })
  return (data ?? []).some((f) => f.name === parts[1])
}

export interface SubmitTaskInput {
  taskId?: unknown
  postUrl?: unknown
  proofPath?: unknown
}

/** Görev gönderimi (tanıtım videosu linki, story ekran görüntüsü ya da otomatik görevin ödül talebi). */
export async function submitTaskAs(
  userId: string,
  input: SubmitTaskInput,
  adminClient: SupabaseClient | null = createSupabaseAdminClient(),
): Promise<Result<{ status: TaskSubmissionStatus }>> {
  try {
    const admin = adminOrError(adminClient)
    if (!isUuid(input.taskId)) return { success: false, error: 'Görev bulunamadı.' }
    const viewer = await loadViewer(admin, userId)
    const audience = audienceForRole(viewer?.role)
    if (!viewer || !audience) return { success: false, error: 'Görevler yalnızca influencer, UGC ve marka hesaplarında.' }
    if (viewer.verification_status !== 'verified') return { success: false, error: 'Hesabın onaylandıktan sonra görev gönderebilirsin.' }

    const { data: taskData } = await admin.from('platform_tasks').select(TASK_COLUMNS).eq('id', input.taskId).maybeSingle()
    const task = taskData as TaskRow | null
    if (!task || task.audience !== audience || !isTaskTargeted(task, userId)) return { success: false, error: 'Görev bulunamadı.' }
    if (!isTaskOpen(task)) return { success: false, error: 'Bu görev şu an kapalı.' }

    const { data: subRows } = await admin.from('task_submissions').select(SUBMISSION_COLUMNS).eq('task_id', task.id).eq('user_id', userId)
    const mine = (subRows ?? []) as SubmissionRow[]
    const approved = mine.filter((s) => s.status === 'approved').length
    if (approved >= task.max_rounds) return { success: false, error: 'Bu görevi zaten tamamladın.' }
    const round = approved + 1
    if (liveFor(mine, round)) return { success: false, error: 'Bu görev için gönderimin zaten değerlendiriliyor.' }

    const now = new Date()
    const row: Record<string, unknown> = { task_id: task.id, user_id: userId, round, created_at: now.toISOString(), updated_at: now.toISOString() }
    const evidence = TASK_KIND_EVIDENCE[task.kind]

    if (evidence === 'post_url') {
      const url = typeof input.postUrl === 'string' ? input.postUrl.trim() : ''
      if (!url || url.length > 500 || !/^https?:\/\//i.test(url)) return { success: false, error: 'Gönderinin bağlantısını yapıştır (https://...).' }
      if (!isMeasurablePostUrl(url)) {
        return { success: false, error: 'Instagram Reels / gönderi ya da TikTok video bağlantısı olmalı (story ve kısa bağlantı ölçülemiyor).' }
      }
      const platform = platformOfUrl(url) as 'instagram' | 'tiktok'
      // Aynı gönderi iki hesaptan gönderilemez.
      const { data: sameUrl } = await admin
        .from('task_submissions')
        .select('post_url')
        .eq('task_id', task.id)
        .in('status', ['measuring', 'in_review', 'approved'])
        .not('post_url', 'is', null)
        .limit(5000)
      if (((sameUrl ?? []) as Array<{ post_url: string | null }>).some((s) => s.post_url && normalizeUrl(s.post_url) === normalizeUrl(url))) {
        return { success: false, error: 'Bu gönderi daha önce gönderilmiş.' }
      }
      const followers = await verifiedFollowers(admin, userId, platform)
      if (followers === null) {
        return { success: false, error: `Bu görev için doğrulanmış ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} hesabın olmalı (gönderi o hesapta olmalı).` }
      }
      Object.assign(row, {
        status: 'measuring',
        post_url: url,
        platform,
        followers_at_submit: followers,
        required_views: requiredPromoViews(followers, task.params),
        measure_due_at: new Date(now.getTime() + promoHoldDays(task.params) * DAY_MS).toISOString(),
      })
    } else if (evidence === 'proof_image') {
      const path = typeof input.proofPath === 'string' ? input.proofPath : ''
      if (!(await proofExists(admin, userId, path))) return { success: false, error: 'Önce story ekran görüntüsünü yükle.' }
      Object.assign(row, { status: 'in_review', proof_path: path })
    } else {
      const facts = await loadFacts(admin, viewer)
      const progress = autoTaskProgress(task.kind, facts, round, task.params)
      if (!progress.every((p) => p.met)) return { success: false, error: 'Görevin koşulları henüz tamamlanmadı.' }
      Object.assign(row, { status: 'in_review', check_note: progress.map((p) => `${p.label}: ${p.current}/${p.target}`).join(' · ').slice(0, 300) })
    }

    const { error } = await admin.from('task_submissions').insert(row)
    if (error) {
      if (error.code === '23505') return { success: false, error: 'Bu görev için gönderimin zaten değerlendiriliyor.' }
      console.error('[tasks] gönderim yazılamadı:', error.message)
      return { success: false, error: 'Gönderim kaydedilemedi. Lütfen tekrar dene.' }
    }
    return { success: true, status: row.status as TaskSubmissionStatus }
  } catch (error) {
    console.error('[tasks] gönderim hatası:', error)
    return { success: false, error: 'Gönderim kaydedilemedi. Lütfen tekrar dene.' }
  }
}

// --- Ölçüm (saatlik görev) ------------------------------------------------------------------------

const formatCount = (n: number) => n.toLocaleString('tr-TR')

/**
 * Zamanı gelen tanıtım videolarını ölçer. Her turda tek platform, tek Apify koşusu, en fazla 10 gönderi (en eski önce).
 * Servis kesintisinde (kredi, ağ) hiçbir gönderiye hata yazılmaz; bir sonraki saatte yeniden denenir.
 */
export async function processDueTaskMeasurements(admin: SupabaseClient, opts: { deadline?: number } = {}) {
  const report = { checked: 0, inReview: 0, rejected: 0, retried: 0, skipped: null as string | null }
  if (opts.deadline && Date.now() > opts.deadline) {
    report.skipped = 'deadline'
    return report
  }
  const { data, error } = await admin
    .from('task_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('status', 'measuring')
    .lte('measure_due_at', new Date().toISOString())
    .order('measure_due_at')
    .limit(CRON_BATCH_LIMIT * 2)
  if (error) throw new Error(`Görev ölçümleri okunamadı: ${error.message}`)
  const due = (data ?? []) as SubmissionRow[]
  if (!due.length) return report

  const platform = due[0].platform === 'tiktok' ? 'tiktok' : 'instagram'
  const batch = due.filter((s) => (s.platform === 'tiktok' ? 'tiktok' : 'instagram') === platform && s.post_url).slice(0, CRON_BATCH_LIMIT)

  let results: Awaited<ReturnType<typeof fetchPostMetrics>>
  try {
    results = await fetchPostMetrics(
      platform,
      batch.map((s) => s.post_url as string),
    )
  } catch (err) {
    if (!(err instanceof ApiRequestError)) {
      console.error('[tasks] ölçüm servisi kullanılamadı:', err)
      report.skipped = 'service'
      return report
    }
    results = new Map(batch.map((s) => [s.post_url as string, { ok: false } as const]))
  }

  const now = new Date().toISOString()
  for (const sub of batch) {
    report.checked++
    const result = results.get(sub.post_url as string) ?? { ok: false as const }
    const required = sub.required_views ?? 0

    if (result.ok) {
      const views = result.views
      const tagged = hasAdTag(result.caption)
      const tagNote = tagged ? '' : ' Reklam etiketi (#reklam / #işbirliği) bulunamadı; elle kontrol edin.'
      let status: TaskSubmissionStatus = 'in_review'
      let note: string
      if (views === null) note = `İzlenme sayısı alınamadı; elle kontrol edin.${tagNote}`
      else if (views >= required) note = `İzlenme ${formatCount(views)} / ${formatCount(required)}.${tagNote}`
      else {
        status = 'rejected'
        note = `İzlenme eşiğin altında: ${formatCount(views)} / ${formatCount(required)}.`
      }
      const { error: updateError } = await admin
        .from('task_submissions')
        .update({
          status,
          measured_views: views,
          measured_likes: result.likes,
          measured_at: now,
          has_ad_tag: tagged,
          check_note: note.trim().slice(0, 300),
          updated_at: now,
        })
        .eq('id', sub.id)
        .eq('status', 'measuring')
      if (updateError) {
        console.error('[tasks] ölçüm yazılamadı:', updateError.message)
        continue
      }
      if (status === 'rejected') {
        report.rejected++
        await notifyUser({
          userId: sub.user_id,
          event: 'task_update',
          title: 'Tanıtım videon eşiğin altında kaldı',
          message: `${note} Yeni bir videoyla tekrar deneyebilirsin.`,
          link: TASKS_LINK,
          type: 'warning',
        }, admin)
      } else {
        report.inReview++
        await notifyUser({
          userId: sub.user_id,
          event: 'task_update',
          title: 'Tanıtım videon ölçüldü',
          message: 'Videon incelemeye alındı. Onaylanınca ödülün bekleyen ödüllerine eklenir.',
          link: TASKS_LINK,
          type: 'info',
        }, admin)
      }
      continue
    }

    const failures = (sub.measure_fail_count ?? 0) + 1
    if (failures >= MEASURE_MAX_FAILURES) {
      report.rejected++
      await admin
        .from('task_submissions')
        .update({
          status: 'rejected',
          measure_fail_count: failures,
          check_note: 'Gönderiye ulaşılamadı (silinmiş ya da gizli olabilir).',
          measured_at: now,
          updated_at: now,
        })
        .eq('id', sub.id)
        .eq('status', 'measuring')
      await notifyUser({
        userId: sub.user_id,
        event: 'task_update',
        title: 'Tanıtım videona ulaşılamadı',
        message: 'Gönderi silinmiş ya da gizli olabilir. Herkese açık yeni bir videoyla tekrar deneyebilirsin.',
        link: TASKS_LINK,
        type: 'warning',
      }, admin)
    } else {
      report.retried++
      await admin
        .from('task_submissions')
        .update({ measure_fail_count: failures, measure_due_at: new Date(Date.now() + MEASURE_RETRY_MS).toISOString(), updated_at: now })
        .eq('id', sub.id)
        .eq('status', 'measuring')
    }
  }
  return report
}

// --- Mavi tik (0₺ dönemi) -------------------------------------------------------------------------

/** Kendi panelindeki mavi tik kartı için; bayrak kapalıysa null. */
export async function loadOwnBlueTickPromo(userId: string): Promise<BlueTickPromo | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  try {
    return (await loadBlueTickPromo(admin, [userId]))?.get(userId) ?? null
  } catch (error) {
    console.error('[tasks] mavi tik dönemi okunamadı:', error)
    return null
  }
}

// --- Admin ----------------------------------------------------------------------------------------

export interface AdminSubmissionView extends TaskSubmissionView {
  taskId: string
  taskTitle: string
  taskKind: TaskKind
  reward: string
  user: { id: string; fullName: string | null; username: string | null; role: string | null }
  platform: string | null
  followersAtSubmit: number | null
  measuredLikes: number | null
  hasAdTag: boolean | null
  /** Story ekran görüntüsü (10 dakikalık imzalı bağlantı). */
  proofUrl: string | null
}

export interface AdminRewardView {
  id: string
  user: { id: string; fullName: string | null; username: string | null; role: string | null }
  taskTitle: string
  text: string
  status: TaskRewardStatus
  code: string | null
  appliedUntil: string | null
  createdAt: string
}

export interface AdminTasksDashboard {
  promoPeriod: boolean
  tasks: Array<TaskRow & { stats: { measuring: number; inReview: number; approved: number; rejected: number } }>
  review: AdminSubmissionView[]
  measuring: AdminSubmissionView[]
  rewards: AdminRewardView[]
  rewardTotals: { pending: number; applied: number; cancelled: number }
}

async function usersById(admin: SupabaseClient, ids: string[]) {
  const map = new Map<string, { id: string; fullName: string | null; username: string | null; role: string | null }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from('users').select('id, full_name, username, role').in('id', ids.slice(i, i + 200))
    for (const u of (data ?? []) as Array<{ id: string; full_name: string | null; username: string | null; role: string | null }>) {
      map.set(u.id, { id: u.id, fullName: u.full_name, username: u.username, role: u.role })
    }
  }
  return map
}

export async function loadAdminTasksDashboard(admin: SupabaseClient): Promise<AdminTasksDashboard> {
  const [{ data: taskRows, error: taskError }, { data: subRows }, { data: rewardRows }, promoPeriod, statRows] = await Promise.all([
    admin.from('platform_tasks').select(TASK_COLUMNS).order('audience').order('sort_order').order('created_at'),
    admin.from('task_submissions').select(SUBMISSION_COLUMNS).in('status', ['measuring', 'in_review']).order('created_at').limit(300),
    admin.from('task_rewards').select(REWARD_COLUMNS).order('created_at', { ascending: false }).limit(300),
    loadPromoPeriod(admin),
    admin.from('task_submissions').select('task_id, status').limit(10000),
  ])
  if (taskError) throw new Error(taskError.message)

  const tasks = (taskRows ?? []) as TaskRow[]
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const subs = (subRows ?? []) as SubmissionRow[]
  const rewards = (rewardRows ?? []) as RewardRow[]

  const stats = new Map<string, { measuring: number; inReview: number; approved: number; rejected: number }>()
  for (const row of (statRows.data ?? []) as Array<{ task_id: string; status: TaskSubmissionStatus }>) {
    const s = stats.get(row.task_id) ?? { measuring: 0, inReview: 0, approved: 0, rejected: 0 }
    if (row.status === 'measuring') s.measuring++
    else if (row.status === 'in_review') s.inReview++
    else if (row.status === 'approved') s.approved++
    else s.rejected++
    stats.set(row.task_id, s)
  }

  const rewardSubIds = rewards.map((r) => r.submission_id)
  const { data: rewardSubs } = rewardSubIds.length
    ? await admin.from('task_submissions').select('id, task_id').in('id', rewardSubIds.slice(0, 300))
    : { data: [] }
  const taskOfSub = new Map(((rewardSubs ?? []) as Array<{ id: string; task_id: string }>).map((s) => [s.id, s.task_id]))
  const people = await usersById(admin, Array.from(new Set([...subs.map((s) => s.user_id), ...rewards.map((r) => r.user_id)])))
  const unknownUser = (id: string) => ({ id, fullName: null, username: null, role: null })

  const toAdminView = async (s: SubmissionRow): Promise<AdminSubmissionView> => {
    const task = taskById.get(s.task_id)
    let proofUrl: string | null = null
    if (s.proof_path) {
      const { data } = await admin.storage.from(TASK_PROOF_BUCKET).createSignedUrl(s.proof_path, 600)
      proofUrl = data?.signedUrl ?? null
    }
    return {
      ...submissionView(s),
      taskId: s.task_id,
      taskTitle: task?.title ?? 'Görev',
      taskKind: (task?.kind ?? 'promo_video') as TaskKind,
      reward: task ? rewardText(task) : '',
      user: people.get(s.user_id) ?? unknownUser(s.user_id),
      platform: s.platform,
      followersAtSubmit: s.followers_at_submit,
      measuredLikes: s.measured_likes,
      hasAdTag: s.has_ad_tag,
      proofUrl,
    }
  }

  const review = await Promise.all(subs.filter((s) => s.status === 'in_review').map(toAdminView))
  const measuring = await Promise.all(subs.filter((s) => s.status === 'measuring').map(toAdminView))

  const rewardTotals = { pending: 0, applied: 0, cancelled: 0 }
  const { data: totalsRows } = await admin.from('task_rewards').select('status').limit(10000)
  for (const r of (totalsRows ?? []) as Array<{ status: TaskRewardStatus }>) rewardTotals[r.status]++

  return {
    promoPeriod,
    tasks: tasks.map((t) => ({ ...t, stats: stats.get(t.id) ?? { measuring: 0, inReview: 0, approved: 0, rejected: 0 } })),
    review,
    measuring,
    rewards: rewards.map((r) => ({
      id: r.id,
      user: people.get(r.user_id) ?? unknownUser(r.user_id),
      taskTitle: taskById.get(taskOfSub.get(r.submission_id) ?? '')?.title ?? 'Görev',
      text: rewardText(r),
      status: r.status,
      code: r.code,
      appliedUntil: r.applied_until,
      createdAt: r.created_at,
    })),
    rewardTotals,
  }
}

/** Görev oluşturur (id yoksa) ya da günceller. Görev türü sonradan değişmez (gönderimlerin anlamı bozulmasın). */
export async function saveTaskAsAdmin(admin: SupabaseClient, adminUserId: string, id: string | null, input: TaskInput): Promise<Result<{ id: string }>> {
  const parsed = validateTaskInput(input)
  if ('error' in parsed) return { success: false, error: parsed.error }
  const now = new Date().toISOString()
  if (id) {
    if (!isUuid(id)) return { success: false, error: 'Görev bulunamadı.' }
    const { data: existing } = await admin.from('platform_tasks').select('kind').eq('id', id).maybeSingle()
    if (!existing) return { success: false, error: 'Görev bulunamadı.' }
    if (existing.kind !== parsed.kind) return { success: false, error: 'Görev türü sonradan değiştirilemez; yeni görev açın.' }
    const { error } = await admin.from('platform_tasks').update({ ...parsed, updated_at: now }).eq('id', id)
    if (error) return { success: false, error: `Görev kaydedilemedi: ${error.message}` }
    return { success: true, id }
  }
  const { data, error } = await admin
    .from('platform_tasks')
    .insert({ ...parsed, created_by: adminUserId, created_at: now, updated_at: now })
    .select('id')
    .single()
  if (error || !data) return { success: false, error: `Görev kaydedilemedi: ${error?.message ?? 'bilinmeyen hata'}` }
  return { success: true, id: data.id as string }
}

function discountCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = 'IM-'
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}

/**
 * İncelemedeki gönderimi onaylar (ödül "bekleyen ödül" olur) ya da reddeder. Ret nedeni zorunlu (2026-10-26): hazır kategori +
 * açıklama; karar kaydedilir (lib/moderation.ts), kullanıcı bir kez itiraz edebilir.
 */
export async function reviewSubmissionAsAdmin(
  admin: SupabaseClient,
  adminUserId: string,
  submissionId: string,
  decision: 'approve' | 'reject',
  reasonInput: DecisionReasonInput | null,
): Promise<Result> {
  if (!isUuid(submissionId)) return { success: false, error: 'Gönderim bulunamadı.' }
  let reviewNote: string | null = null
  let parsedReason: Extract<ReturnType<typeof parseDecisionReason>, { ok: true }>['reason'] | null = null
  if (decision === 'reject') {
    const parsed = parseDecisionReason('task_submission', reasonInput)
    if (!parsed.ok) return { success: false, error: parsed.error }
    parsedReason = parsed.reason
    reviewNote = formatReason(parsed.reason).slice(0, TASK_LIMITS.reviewNoteMax)
  }
  const now = new Date().toISOString()

  // Koşullu güncelleme: aynı anda iki admin karar verirse yalnızca biri geçer.
  const { data: updated, error } = await admin
    .from('task_submissions')
    .update({ status: decision === 'approve' ? 'approved' : 'rejected', review_note: reviewNote, reviewed_by: adminUserId, reviewed_at: now, updated_at: now })
    .eq('id', submissionId)
    .eq('status', 'in_review')
    .select('id, task_id, user_id')
    .maybeSingle()
  if (error) return { success: false, error: `Karar kaydedilemedi: ${error.message}` }
  if (!updated) return { success: false, error: 'Bu gönderim zaten karara bağlanmış ya da ölçüm sürüyor.' }

  const { data: taskData } = await admin.from('platform_tasks').select(TASK_COLUMNS).eq('id', updated.task_id).maybeSingle()
  const task = taskData as TaskRow | null

  if (decision === 'approve' && task) {
    let rewardError: string | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error: insertError } = await admin.from('task_rewards').insert({
        submission_id: updated.id,
        user_id: updated.user_id,
        reward_type: task.reward_type,
        reward_plan: task.reward_plan,
        reward_days: task.reward_days,
        reward_percent: task.reward_percent,
        code: task.reward_type === 'discount_percent' ? discountCode() : null,
        status: 'pending',
      })
      rewardError = insertError ? insertError.message : null
      // Kod çakışmasında yeniden dene; aynı gönderim için ikinci ödül benzersiz kısıtla engellenir.
      if (!insertError || !insertError.message.includes('code')) break
    }
    if (rewardError) {
      // Onayı geri al: ödülsüz onaylı gönderim kalmasın.
      await admin.from('task_submissions').update({ status: 'in_review', reviewed_by: null, reviewed_at: null, updated_at: now }).eq('id', updated.id)
      return { success: false, error: `Ödül yazılamadı: ${rewardError}` }
    }
    // Tanıtım görevi 0₺ döneminde mavi tik şartı: tik hemen yeniden değerlendirilir.
    if (task.kind === 'promo_video') await syncBlueTick(updated.user_id, admin)
  }
  if (decision === 'reject' && parsedReason) {
    await recordDecision(admin, { subjectType: 'task_submission', subjectId: updated.id, userId: updated.user_id, reason: parsedReason, decidedBy: adminUserId })
  }

  await notifyUser(
    decision === 'approve'
      ? {
          userId: updated.user_id,
          event: 'task_update',
          title: 'Görevin onaylandı',
          message: `"${task?.title ?? 'Görev'}" onaylandı. Ödülün (${task ? rewardText(task) : 'ödül'}) bekleyen ödüllerine eklendi; satış başlayınca hesabına işlenir.`,
          link: TASKS_LINK,
          type: 'success',
        }
      : {
          userId: updated.user_id,
          event: 'task_update',
          title: 'Görevin onaylanmadı',
          message: `"${task?.title ?? 'Görev'}": ${reviewNote}. Yeni bir gönderimle tekrar deneyebilir ya da karara bir kez itiraz edebilirsin.`,
          link: TASKS_LINK,
          type: 'warning',
        },
    admin,
  )
  return { success: true }
}

/** Bekleyen ödülü iptal eder (yanlış onay vb.). */
export async function cancelRewardAsAdmin(admin: SupabaseClient, rewardId: string): Promise<Result> {
  if (!isUuid(rewardId)) return { success: false, error: 'Ödül bulunamadı.' }
  const { data, error } = await admin.from('task_rewards').update({ status: 'cancelled' }).eq('id', rewardId).eq('status', 'pending').select('id').maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Yalnızca bekleyen ödül iptal edilebilir.' }
  return { success: true }
}

/**
 * Satış (POS) başlayınca: bekleyen Spotlight süre ödüllerini hesaplara işler (lib/tasks-shared.ts applySpotlightReward),
 * indirim kodlarını kullanılabilir yapar. Aynı kullanıcının birden çok ödülü sırayla eklenir. En fazla 500 ödül / çağrı.
 */
export async function applyPendingRewardsAsAdmin(admin: SupabaseClient): Promise<Result<{ applied: number; skipped: number; failed: number }>> {
  const { data, error } = await admin.from('task_rewards').select(REWARD_COLUMNS).eq('status', 'pending').order('created_at').limit(500)
  if (error) return { success: false, error: error.message }
  const rewards = (data ?? []) as RewardRow[]
  const out = { applied: 0, skipped: 0, failed: 0 }
  const touched = new Set<string>()

  for (const reward of rewards) {
    const now = new Date().toISOString()
    if (reward.reward_type === 'discount_percent') {
      const { error: e } = await admin.from('task_rewards').update({ status: 'applied', applied_at: now }).eq('id', reward.id).eq('status', 'pending')
      if (e) out.failed++
      else {
        out.applied++
        touched.add(reward.user_id)
      }
      continue
    }
    const { data: user } = await admin
      .from('users')
      .select('id, role, spotlight_active, spotlight_plan, spotlight_expires_at')
      .eq('id', reward.user_id)
      .maybeSingle()
    const planCode = user && reward.reward_plan ? spotlightPlanCode(user.role, reward.reward_plan) : null
    if (!user || !planCode || !reward.reward_days) {
      out.failed++
      continue
    }
    const next = applySpotlightReward(user, planCode, reward.reward_days)
    if (!next) {
      // Süresiz aktif plan: süre eklenecek bir şey yok; ödül işlendi sayılır.
      await admin.from('task_rewards').update({ status: 'applied', applied_at: now, applied_plan: user.spotlight_plan, applied_until: null }).eq('id', reward.id)
      out.skipped++
      continue
    }
    const { error: userError } = await admin
      .from('users')
      .update({ spotlight_active: true, spotlight_plan: next.plan, spotlight_expires_at: next.expiresAt })
      .eq('id', user.id)
    if (userError) {
      console.error('[tasks] Spotlight ödülü işlenemedi:', userError.message)
      out.failed++
      continue
    }
    await admin
      .from('task_rewards')
      .update({ status: 'applied', applied_at: now, applied_plan: next.plan, applied_until: next.expiresAt })
      .eq('id', reward.id)
    out.applied++
    touched.add(user.id)
    await syncBlueTick(user.id, admin)
  }

  for (const userId of Array.from(touched)) {
    await notifyUser(
      {
        userId,
        event: 'task_update',
        title: 'Görev ödüllerin hesabına işlendi',
        message: 'Spotlight süren eklendi; indirim kodların artık kullanılabilir. Ayrıntılar Görevler sayfasında.',
        link: TASKS_LINK,
        type: 'success',
      },
      admin,
    )
  }
  return { success: true, ...out }
}
