// Spotlight (ücretli plan) erişim kontrolü. Premium veri sunucuda bu kontrolden geçmeden
// hesaplanmaz veya istemciye gönderilmez; arayüzdeki bulanıklık yalnızca görseldir.
// Süresi dolan planlar saatlik görevde kapanır (lib/spotlight-expiry.ts); aradaki en fazla
// bir saatlik boşluk için bitiş tarihi burada da kontrol edilir.

export interface SpotlightFields {
  spotlight_active?: boolean | null
  spotlight_expires_at?: string | null
}

export function hasActiveSpotlight(row: SpotlightFields | null | undefined, now: Date = new Date()): boolean {
  if (!row?.spotlight_active) return false
  if (!row.spotlight_expires_at) return true
  return new Date(row.spotlight_expires_at).getTime() > now.getTime()
}
