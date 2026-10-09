// İş birliği akışı (yol haritası özellik 1). Teklif kabul edildiğinde ve marka ilan başvurusunu kabul ettiğinde
// ortak bir iş birliği kaydı açılır; iki kaynak da aynı aşamalardan geçer:
//   agreed (anlaşıldı) → in_progress (içerik hazırlanıyor) → published (yayın linki girildi) → completed / cancelled
// Marka yayın linkine 7 gün yanıt vermezse saatlik görev iş birliğini tamamlar.
//
// Tablo istemcilere yalnızca okunur (RLS: taraflar). Bütün yazımlar burada, yetki kontrolünden sonra
// service role ile yapılır. Web sunucu aksiyonları ve mobil uçlar aynı fonksiyonları çağırır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'
import {
  AUTO_COMPLETE_DAYS,
  COLLABORATION_STATUSES,
  type CollaborationAction,
  type CollaborationSource,
  type CollaborationStatus,
} from '@/lib/collaboration-shared'

export {
  AUTO_COMPLETE_DAYS,
  COLLABORATION_STATUSES,
  COLLABORATION_STATUS_LABELS,
  type CollaborationAction,
  type CollaborationSource,
  type CollaborationStatus,
} from '@/lib/collaboration-shared'

const AUTO_COMPLETE_MS = AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000
const ACTIVE_STATUSES: CollaborationStatus[] = ['agreed', 'in_progress', 'published']
const PUBLISH_HOSTS = ['instagram.com', 'tiktok.com', 'youtube.com']
const LINK = '/dashboard/collaborations'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

interface PartyCard {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

export interface CollaborationRow {
  id: string
  brand_id: string
  influencer_id: string
  source: CollaborationSource
  offer_id: string | null
  application_id: string | null
  title: string
  status: CollaborationStatus
  publish_url: string | null
  published_at: string | null
  completed_at: string | null
  auto_completed: boolean
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  room_id: string | null
  created_at: string
  updated_at: string
}

export interface CollaborationListItem extends CollaborationRow {
  viewer_role: 'brand' | 'influencer'
  other: PartyCard | null
  actions: CollaborationAction[]
  /** Yayındaysa otomatik tamamlanacağı an (ISO). */
  auto_complete_at: string | null
  /** Takip alanı özeti (3.18): teslimat sayısı, yayınlanan teslimat, anlaşma özeti durumu. */
  deliverable_total: number
  deliverable_published: number
  agreement_state: 'none' | 'pending' | 'confirmed'
}

const COLUMNS =
  'id, brand_id, influencer_id, source, offer_id, application_id, title, status, publish_url, published_at, completed_at, auto_completed, cancelled_at, cancelled_by, cancel_reason, room_id, created_at, updated_at'
const CARD = 'id, full_name, username, avatar_url'

/** Yayın linki: http(s), Instagram / TikTok / YouTube alan adı (alt alan adları dahil). */
export function validatePublishUrl(raw: unknown): { url: string } | { error: string } {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return { error: 'Yayın linkini girin.' }
  if (value.length > 500) return { error: 'Link en fazla 500 karakter olabilir.' }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { error: 'Geçerli bir link girin (https:// ile başlamalı).' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { error: 'Link http veya https ile başlamalı.' }
  if (parsed.username || parsed.password) return { error: 'Geçerli bir link girin.' }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (!PUBLISH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    return { error: 'Link Instagram, TikTok veya YouTube adresi olmalı.' }
  }
  return { url: parsed.toString() }
}

/** Görüntüleyenin rolüne ve duruma göre yapılabilecek işlemler. */
export function availableActions(
  row: Pick<CollaborationRow, 'status' | 'brand_id' | 'influencer_id' | 'room_id'>,
  userId: string,
  hasDeliverables = false,
): CollaborationAction[] {
  const isBrand = row.brand_id === userId
  const isInfluencer = row.influencer_id === userId
  if (!isBrand && !isInfluencer) return []
  const actions: CollaborationAction[] = []
  if (row.status === 'agreed') actions.push('start')
  // Teslimat listesi olan iş birliğinde yayın linki teslimat başına girilir (takip alanı, 3.18).
  if (isInfluencer && !hasDeliverables && (row.status === 'agreed' || row.status === 'in_progress')) actions.push('publish')
  if (isBrand && row.status === 'published') actions.push('approve')
  if (ACTIVE_STATUSES.includes(row.status)) actions.push('cancel')
  if (!row.room_id) actions.push('open_room')
  return actions
}

function autoCompleteAt(row: Pick<CollaborationRow, 'status' | 'published_at'>) {
  if (row.status !== 'published' || !row.published_at) return null
  return new Date(new Date(row.published_at).getTime() + AUTO_COMPLETE_MS).toISOString()
}

interface CreateInput {
  source: CollaborationSource
  sourceId: string
  brandId: string
  influencerId: string
  title: string | null | undefined
  roomId?: string | null
}

/**
 * Kabul edilen teklif / başvuru için iş birliği açar (zaten varsa dokunmaz; iptal edilmişse yeniden açar).
 * Çağıran taraf kabulün gerçekten gerçekleştiğini doğrulamış olmalıdır. Hata fırlatmaz.
 */
export async function createCollaborationFor(input: CreateInput, admin: SupabaseClient | null = createSupabaseAdminClient()) {
  if (!admin || input.brandId === input.influencerId) return
  const sourceColumn = input.source === 'offer' ? 'offer_id' : 'application_id'
  const title = (input.title?.trim() || (input.source === 'offer' ? 'Teklif' : 'İlan')).slice(0, 200)
  try {
    const { data: existing } = await admin.from('collaborations').select('id, status, room_id').eq(sourceColumn, input.sourceId).maybeSingle()
    let collaborationId: string | null = null
    if (existing) {
      if (existing.status !== 'cancelled') {
        if (!existing.room_id && input.roomId) {
          await admin.from('collaborations').update({ room_id: input.roomId, updated_at: new Date().toISOString() }).eq('id', existing.id)
        }
        return
      }
      // Başvuru yeniden kabul edildi: iptal edilmiş kayıt baştan açılır.
      const { error } = await admin
        .from('collaborations')
        .update({
          status: 'agreed',
          title,
          publish_url: null,
          published_at: null,
          completed_at: null,
          auto_completed: false,
          cancelled_at: null,
          cancelled_by: null,
          cancel_reason: null,
          room_id: input.roomId ?? existing.room_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('status', 'cancelled')
      if (error) throw error
      collaborationId = existing.id as string
    } else {
      const { data: created, error } = await admin
        .from('collaborations')
        .insert({
          brand_id: input.brandId,
          influencer_id: input.influencerId,
          source: input.source,
          [sourceColumn]: input.sourceId,
          title,
          status: 'agreed',
          room_id: input.roomId ?? null,
        })
        .select('id')
        .single()
      if (error) {
        if (error.code === '23505') return // aynı anda iki istek: diğeri açtı
        throw error
      }
      collaborationId = created?.id as string
    }
    if (!collaborationId) return

    const [brandName, influencerName] = await Promise.all([displayNameOf(admin, input.brandId), displayNameOf(admin, input.influencerId)])
    await Promise.all([
      notifyUser(
        {
          userId: input.influencerId,
          event: 'collab_new',
          title: 'Yeni iş birliği',
          message: `${brandName} ile "${title}" iş birliği başladı. Anlaşma özetini ve teslimatları iş birliği sayfasından takip edin.`,
          link: `${LINK}/${collaborationId}`,
          type: 'success',
        },
        admin,
      ),
      notifyUser(
        {
          userId: input.brandId,
          event: 'collab_new',
          title: 'Yeni iş birliği',
          message: `${influencerName} ile "${title}" iş birliği başladı. Anlaşma özetini hazırlayıp süreci iş birliği sayfasından takip edebilirsiniz.`,
          link: `${LINK}/${collaborationId}`,
          type: 'success',
        },
        admin,
      ),
    ])
  } catch (error) {
    console.error('[collaborations] iş birliği açılamadı:', error)
  }
}

/** Kaynağa bağlı, iptal edilmemiş iş birliği var mı (başvuru durumunu geri almadan önce kontrol). */
export async function hasActiveCollaboration(source: CollaborationSource, sourceId: string, admin: SupabaseClient | null = createSupabaseAdminClient()) {
  if (!admin) return false
  const { data } = await admin
    .from('collaborations')
    .select('id')
    .eq(source === 'offer' ? 'offer_id' : 'application_id', sourceId)
    .neq('status', 'cancelled')
    .limit(1)
  return (data?.length ?? 0) > 0
}

/** Kullanıcının iş birlikleri (RLS'li kendi istemcisiyle: yalnızca taraf olduğu kayıtlar). */
export async function listCollaborationsFor(
  supabase: SupabaseClient,
  userId: string,
  options: { status?: string | null; id?: string | null } = {},
): Promise<Result<{ collaborations: CollaborationListItem[] }>> {
  let query = supabase
    .from('collaborations')
    .select(`${COLUMNS}, brand:brand_id(${CARD}), influencer:influencer_id(${CARD})`)
    .or(`brand_id.eq.${userId},influencer_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200)
  if (options.id) query = query.eq('id', options.id)
  if (options.status && COLLABORATION_STATUSES.includes(options.status as CollaborationStatus)) {
    query = query.eq('status', options.status)
  }
  const { data, error } = await query
  if (error) {
    console.error('[collaborations] liste hatası:', error.message)
    return { error: 'İş birlikleri yüklenemedi.' }
  }

  const rows = (data ?? []) as unknown as Array<CollaborationRow & { brand: PartyCard | null; influencer: PartyCard | null }>

  // Oda kaydı eksikse teklif / başvuru odası bulunur (eski kayıtlar, sonradan açılan odalar).
  const missingOffers = rows.filter((r) => !r.room_id && r.offer_id).map((r) => r.offer_id as string)
  const missingApps = rows.filter((r) => !r.room_id && r.application_id).map((r) => r.application_id as string)
  const roomBySource = new Map<string, string>()
  const ids = rows.map((r) => r.id)
  const [offerRooms, appRooms, deliverableRes, agreementRes] = await Promise.all([
    missingOffers.length ? supabase.from('rooms').select('id, offer_id').in('offer_id', missingOffers) : Promise.resolve({ data: [] }),
    missingApps.length ? supabase.from('rooms').select('id, advert_application_id').in('advert_application_id', missingApps) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('collaboration_deliverables').select('collaboration_id, status').in('collaboration_id', ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('collaboration_agreements').select('collaboration_id, brand_confirmed_at, influencer_confirmed_at').in('collaboration_id', ids)
      : Promise.resolve({ data: [] }),
  ])
  const progress = new Map<string, { total: number; published: number }>()
  ;((deliverableRes.data ?? []) as Array<{ collaboration_id: string; status: string }>).forEach((d) => {
    const p = progress.get(d.collaboration_id) ?? { total: 0, published: 0 }
    p.total++
    if (d.status === 'published') p.published++
    progress.set(d.collaboration_id, p)
  })
  const agreementState = new Map<string, 'pending' | 'confirmed'>()
  ;((agreementRes.data ?? []) as Array<{ collaboration_id: string; brand_confirmed_at: string | null; influencer_confirmed_at: string | null }>).forEach(
    (a) => agreementState.set(a.collaboration_id, a.brand_confirmed_at && a.influencer_confirmed_at ? 'confirmed' : 'pending'),
  )
  ;((offerRooms.data ?? []) as Array<{ id: string; offer_id: string | null }>).forEach((r) => r.offer_id && roomBySource.set(r.offer_id, r.id))
  ;((appRooms.data ?? []) as Array<{ id: string; advert_application_id: string | null }>).forEach(
    (r) => r.advert_application_id && roomBySource.set(r.advert_application_id, r.id),
  )

  const collaborations = rows.map(({ brand, influencer, ...row }): CollaborationListItem => {
    const roomId = row.room_id ?? roomBySource.get((row.offer_id ?? row.application_id) as string) ?? null
    const full = { ...row, room_id: roomId }
    const viewerRole: 'brand' | 'influencer' = row.brand_id === userId ? 'brand' : 'influencer'
    const p = progress.get(row.id) ?? { total: 0, published: 0 }
    return {
      ...full,
      viewer_role: viewerRole,
      other: viewerRole === 'brand' ? influencer : brand,
      actions: availableActions(full, userId, p.total > 0),
      auto_complete_at: autoCompleteAt(full),
      deliverable_total: p.total,
      deliverable_published: p.published,
      agreement_state: agreementState.get(row.id) ?? 'none',
    }
  })
  return { success: true, collaborations }
}

/** Sohbet odasını bulur ya da (yalnızca bu iş birliğinin teklif/başvurusu için) açar. */
async function ensureRoom(admin: SupabaseClient, row: CollaborationRow): Promise<string | null> {
  if (row.room_id) return row.room_id
  const column = row.offer_id ? 'offer_id' : 'advert_application_id'
  const sourceId = row.offer_id ?? row.application_id
  if (!sourceId) return null
  const { data: existing } = await admin.from('rooms').select('id').eq(column, sourceId).limit(1).maybeSingle()
  let roomId = (existing?.id as string | undefined) ?? null
  if (!roomId) {
    const { data: created, error } = await admin
      .from('rooms')
      .insert({ [column]: sourceId, brand_id: row.brand_id, influencer_id: row.influencer_id })
      .select('id')
      .single()
    if (error) {
      console.error('[collaborations] oda açılamadı:', error.message)
      return null
    }
    roomId = created?.id as string
  }
  await admin.from('collaborations').update({ room_id: roomId, updated_at: new Date().toISOString() }).eq('id', row.id)
  return roomId
}

export interface CollaborationActionInput {
  action: CollaborationAction
  url?: string | null
  reason?: string | null
}

/**
 * İş birliği işlemi. userId oturumdaki kullanıcıdır (web çerezi veya mobil Bearer ile doğrulanmış);
 * kullanıcı kaydın tarafı değilse ya da işlem rolüne/duruma uygun değilse reddedilir.
 */
export async function runCollaborationAction(
  userId: string,
  collaborationId: string,
  input: CollaborationActionInput,
): Promise<Result<{ roomId?: string | null }>> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  if (!collaborationId || typeof collaborationId !== 'string') return { error: 'İş birliği bulunamadı.' }

  const { data, error } = await admin.from('collaborations').select(COLUMNS).eq('id', collaborationId).maybeSingle()
  if (error || !data) return { error: 'İş birliği bulunamadı.' }
  const row = data as unknown as CollaborationRow
  if (row.brand_id !== userId && row.influencer_id !== userId) return { error: 'İş birliği bulunamadı.' }

  const action = input?.action
  const { count: deliverableCount } = await admin
    .from('collaboration_deliverables')
    .select('id', { count: 'exact', head: true })
    .eq('collaboration_id', row.id)
  if (!availableActions(row, userId, (deliverableCount ?? 0) > 0).includes(action)) {
    return { error: 'Bu işlem şu an yapılamaz. Sayfayı yenileyip tekrar deneyin.' }
  }

  const isBrand = row.brand_id === userId
  const otherId = isBrand ? row.influencer_id : row.brand_id
  const now = new Date().toISOString()

  // Durum geçişi yalnızca beklenen durumdan yapılır (aynı anda iki işlemde ikincisi boşa düşer).
  const transition = async (from: CollaborationStatus[], patch: Record<string, unknown>) => {
    const { data: updated, error: updateError } = await admin
      .from('collaborations')
      .update({ ...patch, updated_at: now })
      .eq('id', row.id)
      .in('status', from)
      .select('id')
    if (updateError) {
      console.error(`[collaborations] ${action} hatası:`, updateError.message)
      return false
    }
    return (updated?.length ?? 0) > 0
  }
  const stale = { error: 'İş birliği bu arada güncellenmiş. Sayfayı yenileyip tekrar deneyin.' }

  switch (action) {
    case 'open_room': {
      const roomId = await ensureRoom(admin, row)
      return roomId ? { success: true, roomId } : { error: 'Sohbet açılamadı. Lütfen tekrar deneyin.' }
    }

    case 'start': {
      if (!(await transition(['agreed'], { status: 'in_progress' }))) return stale
      return { success: true }
    }

    case 'publish': {
      const checked = validatePublishUrl(input.url)
      if ('error' in checked) return { error: checked.error }
      if (!(await transition(['agreed', 'in_progress'], { status: 'published', publish_url: checked.url, published_at: now }))) return stale
      const influencerName = await displayNameOf(admin, userId)
      await notifyUser(
        {
          userId: row.brand_id,
          event: 'collab_published',
          title: 'Yayın linki girildi',
          message: `${influencerName}, "${row.title}" iş birliğinin yayın linkini girdi. İçeriği kontrol edip onaylayın; ${AUTO_COMPLETE_DAYS} gün içinde yanıt verilmezse iş birliği otomatik tamamlanır.`,
          link: `${LINK}/${row.id}`,
        },
        admin,
      )
      return { success: true }
    }

    case 'approve': {
      if (!(await transition(['published'], { status: 'completed', completed_at: now, auto_completed: false }))) return stale
      const brandName = await displayNameOf(admin, userId)
      await Promise.all([
        notifyUser(
          {
            userId: row.influencer_id,
            event: 'collab_completed',
            title: 'İş birliği tamamlandı',
            message: `${brandName}, "${row.title}" iş birliğini onayladı. İş birliği tamamlandı.`,
            link: `${LINK}/${row.id}`,
            type: 'success',
          },
          admin,
        ),
        notifyUser(
          {
            userId: row.brand_id,
            event: 'collab_completed',
            title: 'İş birliği tamamlandı',
            message: `"${row.title}" iş birliğini onayladınız. İş birliği tamamlandı.`,
            link: `${LINK}/${row.id}`,
            type: 'success',
          },
          admin,
        ),
      ])
      return { success: true }
    }

    case 'cancel': {
      const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : ''
      if (!(await transition(ACTIVE_STATUSES, { status: 'cancelled', cancelled_at: now, cancelled_by: userId, cancel_reason: reason || null }))) {
        return stale
      }
      const name = await displayNameOf(admin, userId)
      await notifyUser(
        {
          userId: otherId,
          event: 'collab_cancelled',
          title: 'İş birliği iptal edildi',
          message: `${name}, "${row.title}" iş birliğini iptal etti.${reason ? ` Gerekçe: ${reason}` : ''}`,
          link: `${LINK}/${row.id}`,
          type: 'warning',
        },
        admin,
      )
      return { success: true }
    }

    default:
      return { error: 'Geçersiz işlem.' }
  }
}

/**
 * Saatlik görev: yayın linki girilmiş ve marka 7 gün içinde yanıt vermemiş iş birliklerini tamamlar.
 * deadline geçtiyse yeni kayda başlanmaz (cron süre bütçesi).
 */
export async function autoCompleteCollaborations(admin: SupabaseClient, options: { limit?: number; deadline?: number } = {}) {
  const cutoff = new Date(Date.now() - AUTO_COMPLETE_MS).toISOString()
  const { data, error } = await admin
    .from('collaborations')
    .select('id, brand_id, influencer_id, title')
    .eq('status', 'published')
    .lte('published_at', cutoff)
    .order('published_at', { ascending: true })
    .limit(options.limit ?? 25)
  if (error) throw new Error(error.message)

  let completed = 0
  for (const row of data ?? []) {
    if (options.deadline && Date.now() > options.deadline) break
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await admin
      .from('collaborations')
      .update({ status: 'completed', completed_at: now, auto_completed: true, updated_at: now })
      .eq('id', row.id)
      .eq('status', 'published')
      .select('id')
    if (updateError || !updated?.length) continue
    completed++
    const message = `"${row.title}" iş birliğinin yayın linkine ${AUTO_COMPLETE_DAYS} gün içinde yanıt verilmediği için iş birliği otomatik tamamlandı.`
    await Promise.all([
      notifyUser({ userId: row.influencer_id as string, event: 'collab_completed', title: 'İş birliği tamamlandı', message, link: `${LINK}/${row.id}`, type: 'success' }, admin),
      notifyUser({ userId: row.brand_id as string, event: 'collab_completed', title: 'İş birliği tamamlandı', message, link: `${LINK}/${row.id}`, type: 'info' }, admin),
    ])
  }
  return { due: data?.length ?? 0, completed }
}

/** Influencer'ların tamamlanan iş birliği sayıları (giriş yapmış her kullanıcı görebilir; satırlar gizli kalır). */
export async function completedCollaborationCounts(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await supabase.rpc('completed_collaboration_counts', { p_user_ids: ids.slice(i, i + 500) })
    if (error) {
      console.error('[collaborations] sayılar alınamadı:', error.message)
      break
    }
    ;((data ?? []) as Array<{ user_id: string; completed_count: number }>).forEach((r) => counts.set(r.user_id, r.completed_count))
  }
  return counts
}
