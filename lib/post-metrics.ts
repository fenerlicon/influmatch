// Sonuç raporu (yol haritası özellik 3'ün rapor kısmı, SYSTEM_MAP 3.20).
//   - Yayın linki girilen her teslimat için takip satırı açılır (deliverable_metric_tracking).
//   - Saatlik görev, zamanı gelen gönderilerin herkese açık sayılarını (beğeni, yorum, izlenme) Apify anahtar havuzuyla alır:
//     yayından ~1, 7 ve 30 gün sonra; sonra durur. Her turda tek platform, tek Apify koşusu, en fazla 10 gönderi (en eski önce).
//   - Marka, bir teslimatı 6 saatte bir "Şimdi güncelle" ile elle ölçtürebilir (kilit veritabanında, eşzamanlı istek ikinci koşuyu başlatmaz).
//   - Gönderiye 3 kez arka arkaya ulaşılamazsa (silinmiş / gizli) "ulaşılamıyor" işaretlenir ve bir daha denenmez.
//   - Story (24 saatte kaybolur) ve YouTube bağlantıları ölçülmez ("unsupported"); YouTube için havuzda anahtar yok.
//
// Kişisel veri dışarı gönderilmez: Apify'a yalnızca herkese açık gönderi bağlantısı gider (CLAUDE.md kural 1; Apify onaylı sağlayıcı).
// Okumalar oturumdaki kullanıcının RLS'li istemcisiyle (yalnızca iş birliğinin tarafları); yazımlar service role.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { runApifyActor } from '@/lib/apify'
import { ApiRequestError } from '@/lib/api-keys'
import type { CampaignDashboard } from '@/lib/campaigns-shared'
import {
  MANUAL_REFRESH_HOURS,
  METRIC_MAX_FAILURES,
  METRIC_SCHEDULE,
  engagementOf,
  type CampaignResultRow,
  type CampaignResults,
  type DeliverableMetrics,
  type EngagementRate,
  type MetricPlatform,
  type MetricSnapshot,
  type MetricStage,
  type MetricTrackingStatus,
} from '@/lib/post-metrics-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

/** Tek Apify koşusunda ölçülen en fazla gönderi (saatlik tur). */
const CRON_BATCH_LIMIT = 10
/** Gönderiye özel hatadan sonra yeniden deneme aralığı. */
const RETRY_AFTER_FAILURE_MS = 6 * HOUR_MS
/** Servis kesintisinde (kredi, ağ, 5xx) bir sonraki tur. */
const RETRY_AFTER_OUTAGE_MS = HOUR_MS

const INSTAGRAM_ACTOR = 'apify~instagram-scraper'
const TIKTOK_ACTOR = 'clockworks~tiktok-scraper'

const TRACKING_COLUMNS =
  'deliverable_id, collaboration_id, platform, post_url, status, next_stage, next_due_at, published_at, followers_at_publish, fail_count, last_success_at, last_manual_at'
const SNAPSHOT_COLUMNS = 'deliverable_id, stage, likes, comments, views, shares, captured_at'

interface TrackingRow {
  deliverable_id: string
  collaboration_id: string
  platform: MetricPlatform
  post_url: string
  status: MetricTrackingStatus
  next_stage: Exclude<MetricStage, 'manual'> | null
  next_due_at: string | null
  published_at: string
  followers_at_publish: number | null
  fail_count: number
  last_success_at: string | null
  last_manual_at: string | null
}

type SnapshotRow = MetricSnapshot & { deliverable_id: string }

// --- Bağlantı çözümleme ------------------------------------------------------------------------------

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

export function platformOfUrl(url: string): MetricPlatform {
  const host = hostOf(url)
  if (!host) return 'other'
  if (hostIs(host, 'instagram.com')) return 'instagram'
  if (hostIs(host, 'tiktok.com')) return 'tiktok'
  if (hostIs(host, 'youtube.com') || host === 'youtu.be') return 'youtube'
  return 'other'
}

/** Ölçülebilir mi: Instagram gönderi / Reels ve TikTok video bağlantısı. Story bağlantısı 24 saatte kaybolur. */
function isMeasurable(platform: MetricPlatform, url: string, kind?: string | null) {
  if (platform === 'instagram') return kind !== 'story' && !!instagramCode(url)
  if (platform === 'tiktok') return kind !== 'story'
  return false
}

/** Instagram gönderi kısa kodu: /p/{kod}, /reel/{kod}, /reels/{kod}, /tv/{kod} (kullanıcı adı önekli biçim dahil). */
function instagramCode(url: string | null | undefined): string | null {
  if (!url) return null
  const match = /instagram\.com\/(?:[^/?#]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/i.exec(url)
  return match ? match[1] : null
}

/** TikTok video kimliği: /video/{id} veya /photo/{id}. Kısa bağlantıda (vm.tiktok.com) yok. */
function tiktokId(url: string | null | undefined): string | null {
  if (!url) return null
  const match = /\/(?:video|photo)\/(\d{5,25})/.exec(url)
  return match ? match[1] : null
}

const normalizeUrl = (url: string | null | undefined) => (url ? url.trim().replace(/\/+$/, '').replace(/^http:/i, 'https:').toLowerCase() : '')

// --- Apify -----------------------------------------------------------------------------------------

type PostResult = { ok: true; likes: number | null; comments: number | null; views: number | null; shares: number | null } | { ok: false }

const count = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/**
 * Bağlantıların herkese açık sayılarını tek Apify koşusuyla alır. Dönen harita her bağlantı için sonuç içerir;
 * bulunamayan / hata kaydı dönen gönderi { ok: false }. Servis ve anahtar hataları fırlatılır (gönderiye yazılmaz).
 */
async function fetchPostMetrics(platform: 'instagram' | 'tiktok', urls: string[]): Promise<Map<string, PostResult>> {
  const out = new Map<string, PostResult>()
  if (!urls.length) return out

  if (platform === 'instagram') {
    // "details": gönderi bağlantısı için gönderinin kendisi (beğeni, yorum, video izlenmesi). Sonuç başına ücretlidir.
    const items = await runApifyActor<any>(INSTAGRAM_ACTOR, {
      directUrls: urls,
      resultsType: 'details',
      resultsLimit: 1,
      addParentData: false,
    })
    const byCode = new Map<string, PostResult>()
    const byInput = new Map<string, PostResult>()
    const valid: PostResult[] = []
    for (const item of items ?? []) {
      if (!item || typeof item !== 'object') continue
      const result: PostResult = item.error
        ? { ok: false }
        : {
            ok: true,
            // Beğeni sayısı gizlenmiş gönderide -1 döner: ölçülmedi sayılır.
            likes: count(item.likesCount),
            comments: count(item.commentsCount),
            views: count(item.videoPlayCount) ?? count(item.videoViewCount),
            shares: null,
          }
      const code = item.shortCode ?? instagramCode(item.url) ?? instagramCode(item.inputUrl)
      if (code) byCode.set(String(code), result)
      if (item.inputUrl) byInput.set(normalizeUrl(item.inputUrl), result)
      if (result.ok) valid.push(result)
    }
    for (const url of urls) {
      const code = instagramCode(url)
      const found = byInput.get(normalizeUrl(url)) ?? (code ? byCode.get(code) : undefined) ?? (urls.length === 1 && valid.length === 1 ? valid[0] : undefined)
      out.set(url, found ?? { ok: false })
    }
    return out
  }

  const items = await runApifyActor<any>(TIKTOK_ACTOR, {
    postURLs: urls,
    resultsPerPage: 1,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  })
  const byId = new Map<string, PostResult>()
  const byInput = new Map<string, PostResult>()
  const valid: PostResult[] = []
  for (const item of items ?? []) {
    if (!item || typeof item !== 'object') continue
    const result: PostResult =
      item.error || (item.playCount === undefined && item.diggCount === undefined)
        ? { ok: false }
        : { ok: true, likes: count(item.diggCount), comments: count(item.commentCount), views: count(item.playCount), shares: count(item.shareCount) }
    const id = item.id ? String(item.id) : tiktokId(item.webVideoUrl)
    if (id) byId.set(id, result)
    if (item.submittedVideoUrl) byInput.set(normalizeUrl(item.submittedVideoUrl), result)
    if (item.inputUrl) byInput.set(normalizeUrl(item.inputUrl), result)
    if (result.ok) valid.push(result)
  }
  for (const url of urls) {
    const id = tiktokId(url)
    const found = byInput.get(normalizeUrl(url)) ?? (id ? byId.get(id) : undefined) ?? (urls.length === 1 && valid.length === 1 ? valid[0] : undefined)
    out.set(url, found ?? { ok: false })
  }
  return out
}

// --- Takip satırı ----------------------------------------------------------------------------------

const stageDueAt = (publishedAt: string, days: number) => new Date(new Date(publishedAt).getTime() + days * DAY_MS)

/** Yayından bu yana geçmiş en son ölçüm anı (geç kalan turda tek ölçüm alınır) ve sıradaki ölçüm. */
function stagePlan(publishedAt: string, now = Date.now()) {
  const passed = METRIC_SCHEDULE.filter((s) => stageDueAt(publishedAt, s.days).getTime() <= now)
  const upcoming = METRIC_SCHEDULE.find((s) => stageDueAt(publishedAt, s.days).getTime() > now) ?? null
  return {
    current: passed.length ? passed[passed.length - 1].stage : null,
    next: upcoming ? { stage: upcoming.stage, dueAt: stageDueAt(publishedAt, upcoming.days).toISOString() } : null,
  }
}

/**
 * Yayın linki girilen teslimat için takip satırı açar (yayın işleminden ve saatlik görevin eksik tamamlamasından çağrılır).
 * Hata yayın işlemini bozmaz; yalnızca kaydedilir.
 */
export async function startDeliverableTracking(
  admin: SupabaseClient,
  d: { deliverableId: string; collaborationId: string; influencerId: string; url: string; publishedAt: string; kind?: string | null },
) {
  try {
    const platform = platformOfUrl(d.url)
    const measurable = isMeasurable(platform, d.url, d.kind)
    let followers: number | null = null
    // UGC videosu çoğu zaman markanın hesabında yayınlanır: influencer'ın takipçisi ölçüt olamaz (etkileşim yalnızca izlenmeye göre).
    if (measurable && d.kind !== 'ugc_video') {
      const { data } = await admin
        .from('social_accounts')
        .select('follower_count')
        .eq('user_id', d.influencerId)
        .eq('platform', platform)
        .eq('is_verified', true)
        .order('follower_count', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      followers = count(data?.follower_count)
    }
    const plan = stagePlan(d.publishedAt)
    const first = plan.current ?? 'd1'
    const { error } = await admin.from('deliverable_metric_tracking').upsert(
      {
        deliverable_id: d.deliverableId,
        collaboration_id: d.collaborationId,
        platform,
        post_url: d.url.slice(0, 500),
        status: measurable ? 'active' : 'unsupported',
        next_stage: measurable ? first : null,
        next_due_at: measurable ? (plan.current ? new Date().toISOString() : stageDueAt(d.publishedAt, 1).toISOString()) : null,
        published_at: d.publishedAt,
        followers_at_publish: followers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'deliverable_id', ignoreDuplicates: true },
    )
    if (error) console.error('[post-metrics] takip satırı açılamadı:', error.message)
  } catch (error) {
    console.error('[post-metrics] takip satırı açılamadı:', error)
  }
}

/** Yayınlanmış ama takip satırı olmayan teslimatları tamamlar (eski kayıtlar, yayın anında yazılamayanlar). */
async function ensureTracking(admin: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 31 * DAY_MS).toISOString()
  const { data: published } = await admin
    .from('collaboration_deliverables')
    .select('id, collaboration_id, kind, publish_url, published_at')
    .eq('status', 'published')
    .not('publish_url', 'is', null)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(200)
  const list = (published ?? []) as Array<{ id: string; collaboration_id: string; kind: string; publish_url: string; published_at: string | null }>
  if (!list.length) return 0
  const { data: existing } = await admin
    .from('deliverable_metric_tracking')
    .select('deliverable_id')
    .in(
      'deliverable_id',
      list.map((d) => d.id),
    )
  const have = new Set(((existing ?? []) as Array<{ deliverable_id: string }>).map((r) => r.deliverable_id))
  const missing = list.filter((d) => !have.has(d.id) && d.published_at)
  if (!missing.length) return 0
  const { data: collabs } = await admin
    .from('collaborations')
    .select('id, influencer_id')
    .in('id', Array.from(new Set(missing.map((d) => d.collaboration_id))))
  const influencerOf = new Map(((collabs ?? []) as Array<{ id: string; influencer_id: string }>).map((c) => [c.id, c.influencer_id]))
  for (const d of missing) {
    const influencerId = influencerOf.get(d.collaboration_id)
    if (!influencerId) continue
    await startDeliverableTracking(admin, {
      deliverableId: d.id,
      collaborationId: d.collaboration_id,
      influencerId,
      url: d.publish_url,
      publishedAt: d.published_at as string,
      kind: d.kind,
    })
  }
  return missing.length
}

const isServiceProblem = (error: unknown) => !(error instanceof ApiRequestError)

async function recordSuccess(admin: SupabaseClient, row: TrackingRow, result: Extract<PostResult, { ok: true }>, stage: MetricStage, scheduled: boolean) {
  const now = new Date().toISOString()
  const { error } = await admin.from('deliverable_metric_snapshots').insert({
    deliverable_id: row.deliverable_id,
    collaboration_id: row.collaboration_id,
    stage,
    likes: result.likes,
    comments: result.comments,
    views: result.views,
    shares: result.shares,
    captured_at: now,
  })
  if (error) {
    console.error('[post-metrics] ölçüm yazılamadı:', error.message)
    return false
  }
  const patch: Record<string, unknown> = { fail_count: 0, last_error: null, last_success_at: now, updated_at: now }
  if (scheduled) {
    const plan = stagePlan(row.published_at)
    patch.status = plan.next ? 'active' : 'done'
    patch.next_stage = plan.next?.stage ?? null
    patch.next_due_at = plan.next?.dueAt ?? null
  }
  await admin.from('deliverable_metric_tracking').update(patch).eq('deliverable_id', row.deliverable_id)
  return true
}

async function recordPostFailure(admin: SupabaseClient, row: TrackingRow) {
  const failCount = (row.fail_count ?? 0) + 1
  const giveUp = failCount >= METRIC_MAX_FAILURES
  await admin
    .from('deliverable_metric_tracking')
    .update({
      fail_count: failCount,
      last_error: 'Gönderiye ulaşılamadı.',
      status: giveUp ? 'unavailable' : row.status,
      next_stage: giveUp ? null : row.next_stage,
      next_due_at: giveUp ? null : row.status === 'active' ? new Date(Date.now() + RETRY_AFTER_FAILURE_MS).toISOString() : row.next_due_at,
      updated_at: new Date().toISOString(),
    })
    .eq('deliverable_id', row.deliverable_id)
  return giveUp
}

// --- Saatlik görev ---------------------------------------------------------------------------------

export interface MetricsCronReport {
  backfilled: number
  platform: MetricPlatform | null
  attempted: number
  succeeded: number
  failed: number
  gaveUp: number
  outage: string | null
  skipped?: string
}

/**
 * Zamanı gelen ölçümler (en eski önce). Tek platform, tek Apify koşusu, en fazla 10 gönderi; koşu deadline'dan sonra başlamaz.
 * Seçilen satırlar önce 1 saat ileri "kiralanır": üst üste binen iki tur aynı gönderiyi iki kez ölçmez.
 */
export async function processDueMetrics(admin: SupabaseClient, { deadline, limit = CRON_BATCH_LIMIT }: { deadline: number; limit?: number }): Promise<MetricsCronReport> {
  const report: MetricsCronReport = { backfilled: 0, platform: null, attempted: 0, succeeded: 0, failed: 0, gaveUp: 0, outage: null }
  report.backfilled = await ensureTracking(admin).catch((error) => {
    console.error('[post-metrics] eksik takip satırları tamamlanamadı:', error)
    return 0
  })

  const nowIso = new Date().toISOString()
  const { data: due, error } = await admin
    .from('deliverable_metric_tracking')
    .select(TRACKING_COLUMNS)
    .eq('status', 'active')
    .lte('next_due_at', nowIso)
    .order('next_due_at', { ascending: true })
    .limit(limit * 3)
  if (error) throw new Error(`Ölçüm sırası alınamadı: ${error.message}`)
  const rows = (due ?? []) as TrackingRow[]
  if (!rows.length) return report
  if (Date.now() >= deadline) return { ...report, skipped: 'Süre bütçesi doldu.' }

  const platform = rows[0].platform
  report.platform = platform
  const candidates = rows.filter((r) => r.platform === platform).slice(0, limit)
  if (platform !== 'instagram' && platform !== 'tiktok') {
    // Ölçülemeyen platform sıraya düşmüşse (ör. eski kayıt) kalıcı olarak işaretlenir.
    await admin
      .from('deliverable_metric_tracking')
      .update({ status: 'unsupported', next_stage: null, next_due_at: null, updated_at: nowIso })
      .in(
        'deliverable_id',
        candidates.map((r) => r.deliverable_id),
      )
    return report
  }

  const lease = new Date(Date.now() + RETRY_AFTER_OUTAGE_MS).toISOString()
  const { data: claimed } = await admin
    .from('deliverable_metric_tracking')
    .update({ next_due_at: lease, last_attempt_at: nowIso })
    .in(
      'deliverable_id',
      candidates.map((r) => r.deliverable_id),
    )
    .eq('status', 'active')
    .lte('next_due_at', nowIso)
    .select('deliverable_id')
  const claimedIds = new Set(((claimed ?? []) as Array<{ deliverable_id: string }>).map((r) => r.deliverable_id))
  const batch = candidates.filter((r) => claimedIds.has(r.deliverable_id))
  if (!batch.length) return report
  report.attempted = batch.length

  let results: Map<string, PostResult>
  try {
    results = await fetchPostMetrics(platform, Array.from(new Set(batch.map((r) => r.post_url))))
  } catch (fetchError) {
    if (isServiceProblem(fetchError)) {
      // Kredi / ağ / servis sorunu gönderinin hatası değildir: kira süresi dolunca (1 saat) yeniden denenir.
      report.outage = fetchError instanceof Error ? fetchError.message.slice(0, 200) : String(fetchError)
      return report
    }
    results = new Map(batch.map((r) => [r.post_url, { ok: false } as PostResult]))
  }

  for (const row of batch) {
    const result = results.get(row.post_url) ?? { ok: false }
    if (result.ok) {
      const stage = stagePlan(row.published_at).current ?? row.next_stage ?? 'd1'
      if (await recordSuccess(admin, row, result, stage, true)) report.succeeded++
      else report.failed++
    } else {
      report.failed++
      if (await recordPostFailure(admin, row)) report.gaveUp++
    }
  }
  return report
}

// --- Okuma -----------------------------------------------------------------------------------------

function manualState(row: TrackingRow): { allowed: boolean; available_at: string | null } {
  if (row.status === 'unavailable' || row.status === 'unsupported') return { allowed: false, available_at: null }
  if (!row.last_manual_at) return { allowed: true, available_at: null }
  const next = new Date(row.last_manual_at).getTime() + MANUAL_REFRESH_HOURS * HOUR_MS
  return next <= Date.now() ? { allowed: true, available_at: null } : { allowed: false, available_at: new Date(next).toISOString() }
}

function buildMetrics(row: TrackingRow, snapshots: SnapshotRow[], isBrand: boolean): DeliverableMetrics {
  const own = snapshots
    .filter((s) => s.deliverable_id === row.deliverable_id)
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at))
    .slice(0, 10)
    .map(({ deliverable_id: _ignored, ...s }) => s)
  const latest = own[0] ?? null
  return {
    deliverable_id: row.deliverable_id,
    platform: row.platform,
    status: row.status,
    post_url: row.post_url,
    published_at: row.published_at,
    followers_at_publish: row.followers_at_publish,
    next_stage: row.next_stage,
    next_due_at: row.next_due_at,
    last_success_at: row.last_success_at,
    snapshots: own,
    latest,
    engagement: engagementOf(latest, row.followers_at_publish),
    manual: isBrand ? manualState(row) : null,
  }
}

async function readMetricRows(supabase: SupabaseClient, collaborationIds: string[]) {
  const ids = collaborationIds.filter(isUuid)
  if (!ids.length) return { tracking: [] as TrackingRow[], snapshots: [] as SnapshotRow[] }
  const tracking: TrackingRow[] = []
  const snapshots: SnapshotRow[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const [t, s] = await Promise.all([
      supabase.from('deliverable_metric_tracking').select(TRACKING_COLUMNS).in('collaboration_id', chunk).limit(2000),
      supabase.from('deliverable_metric_snapshots').select(SNAPSHOT_COLUMNS).in('collaboration_id', chunk).order('captured_at', { ascending: false }).limit(5000),
    ])
    if (t.error || s.error) throw new Error(t.error?.message ?? s.error?.message)
    tracking.push(...((t.data ?? []) as TrackingRow[]))
    snapshots.push(...((s.data ?? []) as SnapshotRow[]))
  }
  return { tracking, snapshots }
}

/**
 * Birden çok iş birliğinin teslimat ölçümleri (salt okunur, "Şimdi güncelle" bilgisi yok). Yeniden kullanım için: ileride
 * influencer profilindeki "portföyde sonuç raporları" (4.3-S7) tamamlanan iş birliklerinin ölçümlerini bununla okur; client
 * görüntüleyenin RLS'li istemcisi ya da görünürlük kuralı sunucuda doğrulandıktan sonra service role okuyucusu olmalıdır.
 */
export async function listDeliverableMetrics(client: SupabaseClient, collaborationIds: string[]): Promise<DeliverableMetrics[]> {
  const { tracking, snapshots } = await readMetricRows(client, collaborationIds)
  return tracking.map((row) => buildMetrics(row, snapshots, false))
}

/**
 * İş birliğinin teslimat ölçümleri (deliverable_id → ölçüm). supabase oturumdaki kullanıcının RLS'li istemcisidir:
 * taraf olmayan hiçbir satırı göremez. Hata sayfayı bozmaz: boş harita döner.
 */
export async function getDeliverableMetricsFor(supabase: SupabaseClient, collaborationId: string, isBrand: boolean): Promise<Map<string, DeliverableMetrics>> {
  const out = new Map<string, DeliverableMetrics>()
  try {
    const { tracking, snapshots } = await readMetricRows(supabase, [collaborationId])
    tracking.forEach((row) => out.set(row.deliverable_id, buildMetrics(row, snapshots, isBrand)))
  } catch (error) {
    console.error('[post-metrics] ölçümler okunamadı:', error)
  }
  return out
}

// --- Elle güncelleme (marka) -----------------------------------------------------------------------

/**
 * "Şimdi güncelle": yalnızca iş birliğinin markası, teslimat başına 6 saatte bir. Kilit önce veritabanında alınır
 * (koşullu güncelleme); Apify servis hatasında kilit geri bırakılır. Taraf kontrolü RLS'li okumayla.
 */
export async function refreshDeliverableMetricsAs(
  supabase: SupabaseClient,
  userId: string,
  collaborationId: string,
  deliverableId: string,
): Promise<Result<{ message: string }>> {
  if (!isUuid(collaborationId) || !isUuid(deliverableId)) return { error: 'Teslimat bulunamadı.' }
  const { data: collab } = await supabase.from('collaborations').select('id, brand_id').eq('id', collaborationId).maybeSingle()
  if (!collab) return { error: 'İş birliği bulunamadı.' }
  if (collab.brand_id !== userId) return { error: 'Ölçümü yalnızca marka güncelleyebilir.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  const { data: rowData } = await admin
    .from('deliverable_metric_tracking')
    .select(TRACKING_COLUMNS)
    .eq('deliverable_id', deliverableId)
    .eq('collaboration_id', collaborationId)
    .maybeSingle()
  const row = rowData as TrackingRow | null
  if (!row) return { error: 'Bu teslimat için ölçüm yok. Yayın linki girildikten sonra ölçüm başlar.' }
  if (row.status === 'unsupported') return { error: 'Bu bağlantı türü için ölçüm yapılamıyor.' }
  if (row.status === 'unavailable') return { error: 'Gönderiye ulaşılamıyor (silinmiş ya da gizli olabilir).' }
  if (row.platform !== 'instagram' && row.platform !== 'tiktok') return { error: 'Bu bağlantı türü için ölçüm yapılamıyor.' }

  const now = new Date()
  const cutoff = new Date(now.getTime() - MANUAL_REFRESH_HOURS * HOUR_MS).toISOString()
  const { data: locked } = await admin
    .from('deliverable_metric_tracking')
    .update({ last_manual_at: now.toISOString(), last_attempt_at: now.toISOString() })
    .eq('deliverable_id', deliverableId)
    .or(`last_manual_at.is.null,last_manual_at.lt.${cutoff}`)
    .select('deliverable_id')
  if (!locked?.length) {
    const next = row.last_manual_at ? new Date(new Date(row.last_manual_at).getTime() + MANUAL_REFRESH_HOURS * HOUR_MS) : null
    const when = next ? next.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null
    return { error: `Ölçüm ${MANUAL_REFRESH_HOURS} saatte bir güncellenebilir.${when ? ` Sonraki: ${when}.` : ''}` }
  }

  let result: PostResult
  try {
    result = (await fetchPostMetrics(row.platform, [row.post_url])).get(row.post_url) ?? { ok: false }
  } catch (error) {
    if (isServiceProblem(error)) {
      await admin.from('deliverable_metric_tracking').update({ last_manual_at: row.last_manual_at }).eq('deliverable_id', deliverableId)
      return { error: 'Ölçüm servisi şu anda yanıt vermiyor. Biraz sonra tekrar deneyin.' }
    }
    result = { ok: false }
  }
  if (!result.ok) {
    const gaveUp = await recordPostFailure(admin, row)
    return { error: gaveUp ? 'Gönderiye ulaşılamıyor (silinmiş ya da gizli olabilir); ölçüm durduruldu.' : 'Gönderiye şu anda ulaşılamadı.' }
  }
  if (!(await recordSuccess(admin, row, result, 'manual', false))) return { error: 'Ölçüm kaydedilemedi. Lütfen tekrar deneyin.' }
  return { success: true, message: 'Ölçüm güncellendi.' }
}

// --- Kampanya sonuçları ----------------------------------------------------------------------------

function aggregateEngagement(posts: Array<{ likes: number | null; comments: number | null; views: number | null; followers: number | null }>): EngagementRate | null {
  const withViews = posts.filter((p) => p.views && p.views > 0)
  if (withViews.length) {
    const interactions = withViews.reduce((sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0), 0)
    const views = withViews.reduce((sum, p) => sum + (p.views ?? 0), 0)
    return { value: (interactions / views) * 100, basis: 'views' }
  }
  const withFollowers = posts.filter((p) => p.followers && p.followers > 0)
  if (withFollowers.length) {
    const interactions = withFollowers.reduce((sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0), 0)
    const followers = withFollowers.reduce((sum, p) => sum + (p.followers ?? 0), 0)
    return { value: (interactions / followers) * 100, basis: 'followers' }
  }
  return null
}

/**
 * Kampanya sonuçları. dashboard getCampaignDashboardAs çıktısıdır (sahiplik orada doğrulandı); ölçümler markanın RLS'li
 * istemcisiyle okunur (marka her iş birliğinin tarafıdır). İptal edilen iş birlikleri dahil edilmez.
 */
export async function buildCampaignResults(supabase: SupabaseClient, dashboard: CampaignDashboard): Promise<CampaignResults> {
  const live = dashboard.rows.filter((r) => r.collaboration_id && r.collaboration_status !== 'cancelled')
  let tracking: TrackingRow[] = []
  let snapshots: SnapshotRow[] = []
  try {
    ;({ tracking, snapshots } = await readMetricRows(
      supabase,
      live.map((r) => r.collaboration_id as string),
    ))
  } catch (error) {
    console.error('[post-metrics] kampanya ölçümleri okunamadı:', error)
  }
  const latestByDeliverable = new Map<string, SnapshotRow>()
  for (const s of snapshots) {
    const prev = latestByDeliverable.get(s.deliverable_id)
    if (!prev || prev.captured_at < s.captured_at) latestByDeliverable.set(s.deliverable_id, s)
  }

  const allPosts: Array<{ likes: number | null; comments: number | null; views: number | null; followers: number | null }> = []
  const rows: CampaignResultRow[] = live.map((r) => {
    const own = tracking.filter((t) => t.collaboration_id === r.collaboration_id)
    const posts = own
      .map((t) => ({ t, s: latestByDeliverable.get(t.deliverable_id) ?? null }))
      .filter((p): p is { t: TrackingRow; s: SnapshotRow } => !!p.s)
      .map(({ t, s }) => ({ likes: s.likes, comments: s.comments, views: s.views, followers: t.followers_at_publish, captured_at: s.captured_at }))
    allPosts.push(...posts)
    const likes = posts.reduce((sum, p) => sum + (p.likes ?? 0), 0)
    const comments = posts.reduce((sum, p) => sum + (p.comments ?? 0), 0)
    const viewsKnown = posts.filter((p) => p.views !== null)
    const views = viewsKnown.length ? viewsKnown.reduce((sum, p) => sum + (p.views ?? 0), 0) : null
    const cashFee = r.payment_type === 'cash' && r.agreed_fee && r.agreed_fee > 0 ? r.agreed_fee : null
    const allHaveViews = posts.length > 0 && viewsKnown.length === posts.length
    return {
      key: r.key,
      collaboration_id: r.collaboration_id as string,
      creator: r.creator,
      posts_live: r.deliverables_published,
      posts_measured: posts.length,
      views,
      likes,
      comments,
      engagement: aggregateEngagement(posts),
      cash_fee: cashFee,
      cost_per_1000_views: cashFee && allHaveViews && views && views > 0 ? (cashFee / views) * 1000 : null,
      cost_per_engagement: cashFee && likes + comments > 0 ? cashFee / (likes + comments) : null,
      last_captured_at: posts.reduce<string | null>((max, p) => (!max || p.captured_at > max ? p.captured_at : max), null),
      unavailable: own.filter((t) => t.status === 'unavailable').length,
      unsupported: own.filter((t) => t.status === 'unsupported').length,
    }
  })

  const cpmRows = rows.filter((r) => r.cost_per_1000_views !== null)
  const cpeRows = rows.filter((r) => r.cost_per_engagement !== null)
  const viewsRows = rows.filter((r) => r.views !== null)
  const likes = rows.reduce((sum, r) => sum + r.likes, 0)
  const comments = rows.reduce((sum, r) => sum + r.comments, 0)
  const cpmViews = cpmRows.reduce((sum, r) => sum + (r.views ?? 0), 0)
  const cpeInteractions = cpeRows.reduce((sum, r) => sum + r.likes + r.comments, 0)
  return {
    rows,
    summary: {
      creators: rows.filter((r) => r.posts_live > 0).length,
      posts_live: rows.reduce((sum, r) => sum + r.posts_live, 0),
      posts_measured: rows.reduce((sum, r) => sum + r.posts_measured, 0),
      views: viewsRows.length ? viewsRows.reduce((sum, r) => sum + (r.views ?? 0), 0) : null,
      likes,
      comments,
      engagement: aggregateEngagement(allPosts),
      cost_per_1000_views: cpmViews > 0 ? (cpmRows.reduce((sum, r) => sum + (r.cash_fee ?? 0), 0) / cpmViews) * 1000 : null,
      cost_per_engagement: cpeInteractions > 0 ? cpeRows.reduce((sum, r) => sum + (r.cash_fee ?? 0), 0) / cpeInteractions : null,
      unavailable: rows.reduce((sum, r) => sum + r.unavailable, 0),
      unsupported: rows.reduce((sum, r) => sum + r.unsupported, 0),
      last_captured_at: rows.reduce<string | null>((max, r) => (r.last_captured_at && (!max || r.last_captured_at > max) ? r.last_captured_at : max), null),
    },
  }
}
