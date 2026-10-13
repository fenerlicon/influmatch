import type { SupabaseClient } from '@supabase/supabase-js'
import type { OfferListItem } from '@/components/dashboard/OffersManager'
import { effectiveOfferStatus } from '@/lib/offer-shared'
import type { CollaborationListItem } from '@/lib/collaborations'

// "İşler" sayfası (docs/REDESIGN.md, 3. aşama): teklifler + iş birlikleri tek akışta.
// Veri modeli değişmedi: teklif tabloları kaynak, kabul edilen teklif/başvuru iş birliği olur.

export const WORKS_PATH = '/dashboard/works'

/** Sayfadaki aşamalar (?stage=). */
export type WorkStage = 'offers' | 'active' | 'agreed' | 'in_progress' | 'published' | 'done'
export const WORK_STAGES: WorkStage[] = ['offers', 'active', 'agreed', 'in_progress', 'published', 'done']

export function worksHref(stage?: WorkStage) {
  return stage ? `${WORKS_PATH}?stage=${stage}` : WORKS_PATH
}

export interface BrandOfferItem {
  id: string
  campaign_name: string | null
  campaign_type: string | null
  budget: number | null
  payment_type?: 'cash' | 'barter' | null
  message: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  created_at: string
  room_id?: string | null
  receiver: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    verification_status?: 'pending' | 'verified' | 'rejected' | null
    displayed_badges?: string[] | null
  } | null
}

async function attachRooms<T extends { id: string; room_id?: string | null }>(supabase: SupabaseClient, offers: T[], label: string): Promise<T[]> {
  if (offers.length === 0) return offers
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('id, offer_id')
    .in(
      'offer_id',
      offers.map((o) => o.id),
    )
  if (error) {
    console.error(`[${label}] rooms load error`, error.message)
    return offers
  }
  const roomMap = new Map<string, string>()
  rooms?.forEach((room) => room.offer_id && roomMap.set(room.offer_id, room.id))
  return offers.map((offer) => ({ ...offer, room_id: roomMap.get(offer.id) ?? null }))
}

/** Influencer'a gelen teklifler (gizlenenler hariç) ve gizlenen teklif kimlikleri. */
export async function loadIncomingOffers(supabase: SupabaseClient, userId: string, limit?: number) {
  let query = supabase
    .from('offers')
    .select(
      `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at,
      sender:sender_user_id(id, full_name, avatar_url, username, social_links, verification_status, displayed_badges)`,
    )
    .eq('receiver_user_id', userId)
    .order('created_at', { ascending: false })
  if (limit) query = query.limit(limit)
  const [{ data: offers, error }, { data: dismissed, error: dismissedError }] = await Promise.all([
    query,
    supabase.from('dismissed_offers').select('offer_id').eq('user_id', userId).not('offer_id', 'is', null),
  ])
  if (error) console.error('[loadIncomingOffers] load error', error.message)
  if (dismissedError) console.error('[loadIncomingOffers] dismissed load error', dismissedError.message)

  const dismissedOfferIds = new Set((dismissed ?? []).map((d) => d.offer_id as string).filter(Boolean))
  const visible = ((offers as unknown as OfferListItem[]) ?? []).filter((o) => !dismissedOfferIds.has(o.id))
  return { offers: await attachRooms(supabase, visible, 'loadIncomingOffers'), dismissedOfferIds }
}

/** Markanın gönderdiği teklifler ve listeden kaldırdığı influencer kimlikleri. */
export async function loadSentOffers(supabase: SupabaseClient, userId: string, limit?: number) {
  let query = supabase
    .from('offers')
    .select(
      `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at,
      receiver:receiver_user_id(id, full_name, avatar_url, username, verification_status, displayed_badges)`,
    )
    .eq('sender_user_id', userId)
    .order('created_at', { ascending: false })
  if (limit) query = query.limit(limit)
  const [{ data: offers, error }, { data: dismissed, error: dismissedError }] = await Promise.all([
    query,
    supabase.from('dismissed_offers').select('receiver_user_id').eq('user_id', userId),
  ])
  if (error) console.error('[loadSentOffers] load error', error.message)
  if (dismissedError) console.error('[loadSentOffers] dismissed load error', dismissedError.message)

  const dismissedReceiverIds = Array.from(new Set((dismissed ?? []).map((d) => d.receiver_user_id as string).filter(Boolean)))
  return { offers: await attachRooms(supabase, (offers as unknown as BrandOfferItem[]) ?? [], 'loadSentOffers'), dismissedReceiverIds }
}

export interface WorkCounts {
  offers: number
  agreed: number
  in_progress: number
  published: number
  completed: number
}

/** Aşama kartlarındaki sayılar. Teklif = yanıt bekleyen (süresi dolmamış) teklif. */
export function countWorks(offers: Array<{ status: string; created_at: string }>, collaborations: CollaborationListItem[]): WorkCounts {
  const by = (s: string) => collaborations.filter((c) => c.status === s).length
  return {
    offers: offers.filter((o) => effectiveOfferStatus(o) === 'pending').length,
    agreed: by('agreed'),
    in_progress: by('in_progress'),
    published: by('published'),
    completed: by('completed'),
  }
}
