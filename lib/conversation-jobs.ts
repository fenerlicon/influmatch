// Mesajlar: her sohbetin bağlı olduğu iş (iş birliği > teklif > ilan başvurusu). Sohbet yalnızca teklif veya
// başvuru üzerinden açıldığı için (kullanıcı kararı, 2026-10-09) her odanın bir kaynağı vardır.
// Sunucu kodu; sonuç istemciye düz veri olarak gider.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChipTone } from '@/components/ui'
import { COLLABORATION_STATUS_LABELS, type CollaborationStatus } from '@/lib/collaboration-shared'
import { effectiveOfferStatus } from '@/lib/offer-shared'
import { ACTIVE_COLLAB_STATUSES, COLLABORATION_TONES, worksHref } from '@/lib/works'

export interface ConversationJob {
  kind: 'collaboration' | 'offer' | 'application'
  title: string
  status: string
  tone: ChipTone
  href: string
  /** Süren iş birliği ("Süren işler" filtresi). */
  active: boolean
}

export interface RoomSource {
  id: string
  otherId: string
  created_at: string
  offer_id?: string | null
  advert_application_id?: string | null
}

const OFFER_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: 'Yanıt bekliyor', tone: 'warning' },
  accepted: { label: 'Kabul edildi', tone: 'success' },
  rejected: { label: 'Reddedildi', tone: 'neutral' },
  expired: { label: 'Süresi doldu', tone: 'neutral' },
}

const APPLICATION_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: 'Başvuru bekliyor', tone: 'warning' },
  shortlisted: { label: 'Ön listede', tone: 'info' },
  accepted: { label: 'Kabul edildi', tone: 'success' },
  rejected: { label: 'Olumsuz', tone: 'neutral' },
}

/** Karşı taraf kimliği → o kişiyle olan en anlamlı iş. Okuma hataları sohbeti engellemez (iş satırı görünmez). */
export async function conversationJobs(
  supabase: SupabaseClient,
  userId: string,
  role: 'brand' | 'influencer',
  rooms: RoomSource[],
): Promise<Map<string, ConversationJob>> {
  const jobs = new Map<string, ConversationJob>()
  if (rooms.length === 0) return jobs

  const offerIds = rooms.map((r) => r.offer_id).filter((id): id is string => !!id)
  const applicationIds = rooms.map((r) => r.advert_application_id).filter((id): id is string => !!id)

  const [collabs, offers, applications] = await Promise.all([
    supabase
      .from('collaborations')
      .select('id, brand_id, influencer_id, title, status, created_at')
      .or(`brand_id.eq.${userId},influencer_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(300),
    offerIds.length ? supabase.from('offers').select('id, campaign_name, status, created_at').in('id', offerIds) : Promise.resolve({ data: [], error: null }),
    applicationIds.length
      ? supabase.from('advert_applications').select('id, status, advert:advert_id(title)').in('id', applicationIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (collabs.error) console.error('[conversationJobs] collaborations', collabs.error.message)
  if (offers.error) console.error('[conversationJobs] offers', offers.error.message)
  if (applications.error) console.error('[conversationJobs] applications', applications.error.message)

  // 1) İş birliği: önce süren, yoksa en yenisi.
  for (const c of collabs.data ?? []) {
    const otherId = c.brand_id === userId ? c.influencer_id : c.brand_id
    const status = c.status as CollaborationStatus
    const active = ACTIVE_COLLAB_STATUSES.includes(status)
    const existing = jobs.get(otherId)
    if (existing && (existing.active || !active)) continue
    jobs.set(otherId, {
      kind: 'collaboration',
      title: c.title || 'İş birliği',
      status: COLLABORATION_STATUS_LABELS[status] ?? status,
      tone: COLLABORATION_TONES[status] ?? 'neutral',
      href: `/dashboard/collaborations/${c.id}`,
      active,
    })
  }

  // 2) İş birliği yoksa odanın kaynağı: en yeni odanın teklifi ya da başvurusu.
  const offerMap = new Map((offers.data ?? []).map((o) => [o.id as string, o]))
  const appMap = new Map(((applications.data ?? []) as unknown as Array<{ id: string; status: string; advert: { title: string | null } | null }>).map((a) => [a.id, a]))
  const newestFirst = [...rooms].sort((a, b) => b.created_at.localeCompare(a.created_at))
  for (const room of newestFirst) {
    if (jobs.has(room.otherId)) continue
    const offer = room.offer_id ? offerMap.get(room.offer_id) : null
    if (offer) {
      const s = OFFER_STATUS[effectiveOfferStatus(offer)] ?? OFFER_STATUS.pending
      jobs.set(room.otherId, { kind: 'offer', title: offer.campaign_name || 'Teklif', status: s.label, tone: s.tone, href: worksHref('offers'), active: false })
      continue
    }
    const app = room.advert_application_id ? appMap.get(room.advert_application_id) : null
    if (app) {
      const s = APPLICATION_STATUS[app.status] ?? APPLICATION_STATUS.pending
      jobs.set(room.otherId, {
        kind: 'application',
        title: app.advert?.title || 'İlan başvurusu',
        status: s.label,
        tone: s.tone,
        href: role === 'brand' ? '/dashboard/brand/advert?tab=applications' : '/dashboard/influencer/advert?tab=applications',
        active: false,
      })
    }
  }
  return jobs
}

export const JOB_KIND_LABEL: Record<ConversationJob['kind'], string> = {
  collaboration: 'İş',
  offer: 'Teklif',
  application: 'İlan başvurusu',
}
