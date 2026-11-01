import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import {
  CONTENT_COVER_BUCKET,
  CONTENT_COVER_TYPES,
  CONTENT_PLAN_OWNER_ID,
  CONTENT_STATUSES,
  addDays,
  isValidDate,
  type ContentItem,
  type ContentItemInput,
  type ContentPlanResult,
  type ContentSeries,
  type ContentSeriesInput,
  type ContentStatus,
} from '@/lib/content-plan-shared'

// İçerik planı (/toplanti). Tablolar istemci rollerine kapalı; okuma ve yazma yalnızca buradan, service role ile.
// Takip adminlerde /admin/icerik-plani (salt okunur). Kapaklar özel kovada; okuma imzalı bağlantıyla.
export { CONTENT_PLAN_OWNER_ID }

const ITEM_COLUMNS = 'id, series_id, episode_no, title, status, publish_date, publish_time, shoot_date, script, caption, notes, video_url, cover_path, created_at'
const SERIES_COLUMNS = 'id, title, description, planned_count, start_date, created_at'
const MAX_EPISODES = 365
const COVER_URL_TTL_SECONDS = 6 * 60 * 60
const COVER_PATH_RE = new RegExp(`^${CONTENT_PLAN_OWNER_ID}/[0-9a-f-]{36}\\.(jpg|png|webp)$`)

export async function loadContentPlan(admin: SupabaseClient): Promise<{ series: ContentSeries[]; items: ContentItem[] }> {
  const [seriesResult, itemsResult] = await Promise.all([
    admin.from('content_series').select(SERIES_COLUMNS).eq('owner_id', CONTENT_PLAN_OWNER_ID).order('created_at', { ascending: false }),
    admin.from('content_items').select(ITEM_COLUMNS).eq('owner_id', CONTENT_PLAN_OWNER_ID).order('publish_date', { ascending: true, nullsFirst: false }).limit(2000),
  ])
  if (seriesResult.error) throw new Error(seriesResult.error.message)
  if (itemsResult.error) throw new Error(itemsResult.error.message)
  const rows = (itemsResult.data ?? []) as Omit<ContentItem, 'cover_url'>[]

  // Kapak bağlantısı üretilemezse plan yine açılır, kapak görünmez.
  const paths = rows.map((row) => row.cover_path).filter((path): path is string => !!path)
  const coverUrls = new Map<string, string>()
  if (paths.length) {
    const { data, error } = await admin.storage.from(CONTENT_COVER_BUCKET).createSignedUrls(paths, COVER_URL_TTL_SECONDS)
    if (error) console.error('[content-plan] kapak bağlantıları', error.message)
    ;(data ?? []).forEach((entry) => {
      if (entry.path && entry.signedUrl) coverUrls.set(entry.path, entry.signedUrl)
    })
  }

  return {
    series: (seriesResult.data ?? []) as ContentSeries[],
    items: rows.map((row) => ({ ...row, cover_url: row.cover_path ? coverUrls.get(row.cover_path) ?? null : null })),
  }
}

/** Kapak için imzalı yükleme adresi; dosya tarayıcıdan doğrudan kovaya gider. */
export async function createContentCoverUpload(admin: SupabaseClient, contentType: unknown): Promise<{ success: true; path: string; token: string } | { success: false; error: string }> {
  const extension = typeof contentType === 'string' ? CONTENT_COVER_TYPES[contentType] : undefined
  if (!extension) return fail('Kapak JPG, PNG ya da WEBP olmalı.')
  const { data, error } = await admin.storage.from(CONTENT_COVER_BUCKET).createSignedUploadUrl(`${CONTENT_PLAN_OWNER_ID}/${randomUUID()}.${extension}`)
  if (error || !data) {
    console.error('[content-plan] kapak yükleme adresi', error?.message)
    return fail('Kapak yüklenemedi.')
  }
  return { success: true, path: data.path, token: data.token }
}

async function removeCoverFile(admin: SupabaseClient, path: string | null | undefined) {
  if (!path) return
  const { error } = await admin.storage.from(CONTENT_COVER_BUCKET).remove([path])
  if (error) console.error('[content-plan] kapak silinemedi', error.message)
}

const fail = (error: string): { success: false; error: string } => ({ success: false, error })

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

function date(value: unknown): string | null {
  return typeof value === 'string' && isValidDate(value) ? value : null
}

function count(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_EPISODES ? parsed : null
}

function itemRow(input: ContentItemInput) {
  const title = text(input.title, 160)
  if (!title) return { error: 'Başlık girin.' }
  const status = CONTENT_STATUSES.includes(input.status as ContentStatus) ? (input.status as ContentStatus) : 'idea'
  // Instagram'dan kopyalanan bağlantı "instagram.com/reel/…" biçiminde de gelebilir.
  const rawUrl = text(input.video_url, 490)
  const videoUrl = rawUrl && !/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? `https://${rawUrl}` : rawUrl
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) return { error: 'Geçerli bir video linki girin.' }
  if (typeof input.cover_path === 'string' && !COVER_PATH_RE.test(input.cover_path)) return { error: 'Kapak geçersiz.' }
  const time = typeof input.publish_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d/.test(input.publish_time) ? input.publish_time.slice(0, 5) : null
  const seriesId = text(input.series_id, 40)
  return {
    row: {
      title,
      status,
      series_id: seriesId,
      episode_no: seriesId ? count(input.episode_no) : null,
      publish_date: date(input.publish_date),
      publish_time: time,
      shoot_date: date(input.shoot_date),
      script: text(input.script, 10000),
      caption: text(input.caption, 2200),
      notes: text(input.notes, 2000),
      video_url: videoUrl,
      ...(input.cover_path === undefined ? {} : { cover_path: typeof input.cover_path === 'string' ? input.cover_path : null }),
    },
  }
}

async function ownsSeries(admin: SupabaseClient, seriesId: string): Promise<boolean> {
  const { data } = await admin.from('content_series').select('id').eq('id', seriesId).eq('owner_id', CONTENT_PLAN_OWNER_ID).maybeSingle()
  return !!data
}

export async function saveContentItem(admin: SupabaseClient, id: string | null, input: ContentItemInput): Promise<ContentPlanResult> {
  const parsed = itemRow(input && typeof input === 'object' ? input : {})
  if (!parsed.row) return fail(parsed.error ?? 'Geçersiz içerik.')
  if (parsed.row.series_id && !(await ownsSeries(admin, parsed.row.series_id))) return fail('Seri bulunamadı.')

  let previousCover: string | null = null
  if (id && parsed.row.cover_path !== undefined) {
    const { data } = await admin.from('content_items').select('cover_path').eq('id', id).eq('owner_id', CONTENT_PLAN_OWNER_ID).maybeSingle()
    previousCover = data?.cover_path ?? null
  }

  const query = id
    ? admin.from('content_items').update({ ...parsed.row, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', CONTENT_PLAN_OWNER_ID)
    : admin.from('content_items').insert({ ...parsed.row, owner_id: CONTENT_PLAN_OWNER_ID })
  const { error } = await query
  if (error) {
    console.error('[content-plan] saveContentItem', error.message)
    return fail('İçerik kaydedilemedi.')
  }
  if (previousCover && previousCover !== parsed.row.cover_path) await removeCoverFile(admin, previousCover)
  return { success: true, message: 'İçerik kaydedildi.' }
}

export async function deleteContentItem(admin: SupabaseClient, id: string): Promise<ContentPlanResult> {
  const { data: existing } = await admin.from('content_items').select('cover_path').eq('id', id).eq('owner_id', CONTENT_PLAN_OWNER_ID).maybeSingle()
  const { error } = await admin.from('content_items').delete().eq('id', id).eq('owner_id', CONTENT_PLAN_OWNER_ID)
  if (error) {
    console.error('[content-plan] deleteContentItem', error.message)
    return fail('İçerik silinemedi.')
  }
  await removeCoverFile(admin, existing?.cover_path)
  return { success: true, message: 'İçerik silindi.' }
}

/**
 * Seri kaydı. Yeni seride `episodeTitles` satırları ve planlanan sayıdan bölümler açılır:
 * başlık yazılmamış bölüm "N. bölüm" olur, başlangıç tarihi varsa paylaşım tarihleri `intervalDays` arayla dizilir.
 */
export async function saveContentSeries(
  admin: SupabaseClient,
  id: string | null,
  input: ContentSeriesInput,
  episodeTitles: string[] = [],
  intervalDays = 1,
): Promise<ContentPlanResult> {
  const source = input && typeof input === 'object' ? input : {}
  const title = text(source.title, 160)
  if (!title) return fail('Seri adı girin.')
  const row = {
    title,
    description: text(source.description, 2000),
    planned_count: count(source.planned_count),
    start_date: date(source.start_date),
  }

  if (id) {
    const { error } = await admin.from('content_series').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', CONTENT_PLAN_OWNER_ID)
    if (error) {
      console.error('[content-plan] saveContentSeries', error.message)
      return fail('Seri kaydedilemedi.')
    }
    return { success: true, message: 'Seri kaydedildi.' }
  }

  const { data, error } = await admin.from('content_series').insert({ ...row, owner_id: CONTENT_PLAN_OWNER_ID }).select('id').single()
  if (error || !data) {
    console.error('[content-plan] saveContentSeries', error?.message)
    return fail('Seri oluşturulamadı.')
  }

  const titles = (Array.isArray(episodeTitles) ? episodeTitles : []).map((t) => text(t, 160)).filter((t): t is string => !!t).slice(0, MAX_EPISODES)
  const total = Math.max(titles.length, row.planned_count ?? 0)
  if (total === 0) return { success: true, message: 'Seri oluşturuldu.' }

  const step = Number.isInteger(intervalDays) && intervalDays >= 1 && intervalDays <= 30 ? intervalDays : 1
  const startDate = row.start_date
  const episodes = Array.from({ length: total }, (_, index) => ({
    owner_id: CONTENT_PLAN_OWNER_ID,
    series_id: data.id,
    episode_no: index + 1,
    title: titles[index] ?? `${index + 1}. bölüm`,
    status: 'planned' as const,
    publish_date: startDate ? addDays(startDate, index * step) : null,
  }))
  const { error: episodesError } = await admin.from('content_items').insert(episodes)
  if (episodesError) {
    console.error('[content-plan] series episodes', episodesError.message)
    return fail('Seri oluşturuldu ama bölümler eklenemedi. Bölümleri seri ekranından ekleyebilirsiniz.')
  }
  return { success: true, message: `Seri ve ${total} bölüm oluşturuldu.` }
}

/** Seri silinir; bölümleri silinmez, bağımsız içerik olarak kalır. */
export async function deleteContentSeries(admin: SupabaseClient, id: string): Promise<ContentPlanResult> {
  const { error: itemsError } = await admin.from('content_items').update({ episode_no: null }).eq('series_id', id).eq('owner_id', CONTENT_PLAN_OWNER_ID)
  if (itemsError) {
    console.error('[content-plan] deleteContentSeries', itemsError.message)
    return fail('Seri silinemedi.')
  }
  const { error } = await admin.from('content_series').delete().eq('id', id).eq('owner_id', CONTENT_PLAN_OWNER_ID)
  if (error) {
    console.error('[content-plan] deleteContentSeries', error.message)
    return fail('Seri silinemedi.')
  }
  return { success: true, message: 'Seri silindi; içerikleri planda kaldı.' }
}
