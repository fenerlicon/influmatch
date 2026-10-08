// Fiyat kartı sabitleri ve yardımcıları (sunucu ve tarayıcı ortak; sunucuya özel içe aktarım yok).

export const RATE_CARD_ITEMS = [
  { key: 'story', column: 'story_price', label: 'Story' },
  { key: 'reel', column: 'reel_price', label: 'Reels' },
  { key: 'post', column: 'post_price', label: 'Gönderi' },
  { key: 'ugc_video', column: 'ugc_video_price', label: 'UGC video' },
  { key: 'package', column: 'package_price', label: 'Paket' },
] as const

export type RateCardKey = (typeof RATE_CARD_ITEMS)[number]['key']
export type RateCardColumn = (typeof RATE_CARD_ITEMS)[number]['column']

export const RATE_CARD_MAX_PRICE = 10_000_000
export const RATE_CARD_COLUMNS = 'user_id, story_price, reel_price, post_price, ugc_video_price, package_price, negotiable, updated_at'

export interface RateCard {
  prices: Partial<Record<RateCardKey, number>>
  negotiable: boolean
  updated_at: string | null
}

/** Satırı (tablo kolonları) arayüz biçimine çevirir. */
export function rateCardFromRow(row: Record<string, unknown> | null | undefined): RateCard | null {
  if (!row) return null
  const prices: Partial<Record<RateCardKey, number>> = {}
  for (const item of RATE_CARD_ITEMS) {
    const value = row[item.column]
    if (typeof value === 'number' && value > 0) prices[item.key] = value
  }
  if (Object.keys(prices).length === 0) return null
  return { prices, negotiable: row.negotiable === true, updated_at: (row.updated_at as string | null) ?? null }
}

/** Kartın en düşük başlangıç fiyatı (keşifte bütçe filtresi için). */
export function minRatePrice(card: RateCard | null): number | null {
  if (!card) return null
  const values = Object.values(card.prices).filter((v): v is number => typeof v === 'number')
  return values.length ? Math.min(...values) : null
}

export function formatTry(value: number) {
  return `₺${value.toLocaleString('tr-TR')}`
}
