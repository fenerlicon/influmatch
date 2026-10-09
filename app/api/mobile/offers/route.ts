import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createOfferAs } from '@/lib/offers'
import { fetchAccountRole } from '@/lib/viewer-role'
import { effectiveOfferStatus } from '@/lib/offer-shared'
import { brandReliability } from '@/lib/collaboration-workspace'

export const dynamic = 'force-dynamic'

const CARD = 'id, full_name, username, avatar_url, verification_status, displayed_badges'

/** Kullanıcının teklifleri: influencer için gelenler, marka için gönderdikleri. Her teklifte varsa sohbet odası. */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const { supabase, user } = ctx

  const role = await fetchAccountRole(supabase, user.id)
  if (role !== 'brand' && role !== 'influencer') return mobileJson({ offers: [] })

  const own = role === 'brand' ? 'sender_user_id' : 'receiver_user_id'
  const { data: offers, error } = await supabase
    .from('offers')
    .select(
      `id, campaign_name, campaign_type, budget, payment_type, message, status, created_at,
      sender:sender_user_id(${CARD}), receiver:receiver_user_id(${CARD})`,
    )
    .eq(own, user.id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.error('[mobile/offers] list error:', error)
    return mobileJson({ error: 'Teklifler yüklenemedi.' }, 500)
  }

  const list = offers ?? []
  const roomByOffer = new Map<string, string>()
  if (list.length > 0) {
    const { data: rooms } = await supabase.from('rooms').select('id, offer_id').in('offer_id', list.map((o) => o.id))
    rooms?.forEach((room) => room.offer_id && roomByOffer.set(room.offer_id as string, room.id as string))
  }

  let dismissed = new Set<string>()
  if (role === 'influencer') {
    const { data } = await supabase.from('dismissed_offers').select('offer_id').eq('user_id', user.id).not('offer_id', 'is', null)
    dismissed = new Set((data ?? []).map((row) => row.offer_id as string))
  }

  // Influencer'a gönderen markanın güvenilirliği (3.18): tamamlanan iş birliği ve ödeme teyitli sayısı.
  const reliability =
    role === 'influencer'
      ? await brandReliability(
          supabase,
          list.map((o) => (o.sender as unknown as { id?: string } | null)?.id ?? '').filter(Boolean),
        )
      : new Map<string, { completed: number; confirmed: number }>()

  return mobileJson({
    role,
    offers: list
      .filter((offer) => !dismissed.has(offer.id))
      // Süresi dolan teklif (saatlik görev henüz işaretlemese de) 'expired' olarak döner.
      .map((offer) => {
        const senderId = (offer.sender as unknown as { id?: string } | null)?.id
        return {
          ...offer,
          status: effectiveOfferStatus(offer),
          room_id: roomByOffer.get(offer.id) ?? null,
          sender_reliability: role === 'influencer' && senderId ? reliability.get(senderId) ?? { completed: 0, confirmed: 0 } : null,
        }
      }),
  })
}

/** Marka teklif gönderir. Gövde: { receiverId, campaignName, campaignType?, budget?, message?, paymentType? } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result = await createOfferAs(ctx.supabase, ctx.user.id, body)
  return mobileJson(result, 'error' in result ? 400 : 200)
}
