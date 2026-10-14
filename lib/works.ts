import type { SupabaseClient } from '@supabase/supabase-js'
import type { OfferListItem } from '@/components/dashboard/OffersManager'
import type { ChipTone } from '@/components/ui'
import { effectiveOfferStatus, type OfferStatus } from '@/lib/offer-shared'
import type { CollaborationStatus } from '@/lib/collaboration-shared'
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
  status: OfferStatus
  created_at: string
  /** Marka bekleyen teklifi düzenlediyse (2026-10-14). */
  edited_at?: string | null
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
      `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at, edited_at,
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
      `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at, edited_at,
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

// --- İş birliği satırı yardımcıları (İşler listesi ve ana sayfalar ortak; sunucu + istemci) ---

export const ACTIVE_COLLAB_STATUSES: CollaborationStatus[] = ['agreed', 'in_progress', 'published']

export const COLLABORATION_TONES: Record<CollaborationStatus, ChipTone> = {
  agreed: 'gold',
  in_progress: 'info',
  published: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

export const formatShortDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }) : null

/** Satırdaki kısa durum cümlesi: kimden ne bekleniyor. */
export function collaborationNextStep(item: CollaborationListItem, role: 'brand' | 'influencer', currentUserId: string): string {
  switch (item.status) {
    case 'agreed':
      if (item.agreement_state === 'pending') return 'Anlaşma özeti onay bekliyor'
      if (item.agreement_state === 'none') return 'Anlaşma özeti hazırlanmadı'
      return role === 'influencer' ? 'İçeriğe başlayabilirsin' : 'Influencer içeriğe başlayacak'
    case 'in_progress':
      return item.deliverable_total > 0 ? `${item.deliverable_published} / ${item.deliverable_total} teslimat yayında` : 'İçerik hazırlanıyor'
    case 'published':
      return role === 'brand'
        ? `Onayın bekleniyor${item.auto_complete_at ? ` · ${formatShortDate(item.auto_complete_at)} tarihinde otomatik tamamlanır` : ''}`
        : `Marka onayı bekleniyor${item.auto_complete_at ? ` · en geç ${formatShortDate(item.auto_complete_at)}` : ''}`
    case 'completed':
      return `${formatShortDate(item.completed_at) ?? ''} tamamlandı${item.auto_completed ? ' (otomatik)' : ''}`
    case 'cancelled':
      return `${formatShortDate(item.cancelled_at) ?? ''} · ${item.cancelled_by === currentUserId ? 'sen iptal ettin' : 'karşı taraf iptal etti'}`
  }
}

/** İstanbul saatine göre selamlama. */
export function greetingFor(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('tr-TR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Istanbul' }).format(date))
  if (hour < 6) return 'İyi geceler'
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  return 'İyi akşamlar'
}
