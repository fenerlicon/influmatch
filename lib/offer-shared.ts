// Teklif süresi ve şablon sınırları: sunucu ve istemci bileşenlerinin ortak sabitleri (gizli bilgi yok).

/** Yanıtlanmayan teklif bu kadar gün sonra "Süresi doldu" olur (yol haritası, 2026-10-10 kararı). */
export const OFFER_EXPIRY_DAYS = 7
export const OFFER_EXPIRY_MS = OFFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000

/** Marka başına en fazla teklif şablonu. */
export const OFFER_TEMPLATE_LIMIT = 20

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

/**
 * Ekranda gösterilecek durum. Saatlik görev henüz çalışmadıysa 7 günü geçen bekleyen teklif de
 * "expired" sayılır (sunucu da bu teklifi kabul etmez).
 */
export function effectiveOfferStatus(offer: { status: string | null | undefined; created_at?: string | null }, now = Date.now()): string {
  const status = offer.status ?? 'pending'
  if (status !== 'pending' || !offer.created_at) return status
  const created = Date.parse(offer.created_at)
  return Number.isFinite(created) && now - created >= OFFER_EXPIRY_MS ? 'expired' : status
}
