// Barter teslimat adresi (2026-11-24): istemci + sunucu ortak tipler ve doğrulama (saf kod).
// Mobil kopya mobile-app/constants/shipping.js (aynı tutulur, tests/mobile-parity.test.ts denetler).

export interface ShippingAddress {
  recipient_name: string
  phone: string
  address_line: string
  district: string
  city: string
  postal_code: string | null
  note: string | null
}

export const SHIPPING_LIMITS = { recipientMax: 120, addressMax: 300, districtMax: 80, cityMax: 80, noteMax: 300 } as const

export const SHIPPING_BRAND_LOCKED_NOTE = 'Teslimat adresi, anlaşma özeti iki tarafça onaylandıktan sonra görünür.'
export const SHIPPING_INFLUENCER_NOTE =
  'Barter iş birliğinde ürünün gönderileceği adres. Marka adresi yalnızca anlaşma özeti iki tarafça onaylandıktan sonra görür; başka kimse göremez.'

/** Görünüm: workspace içinde. */
export interface ShippingView {
  /** Anlaşma barter mı (adres yalnızca barter'da istenir). */
  needed: boolean
  /** Influencer: kendi adresi ya da önceki iş birliğinden öneri; marka: görünürse adres. */
  address: ShippingAddress | null
  /** Influencer için: adres bu iş birliğine henüz kaydedilmedi, öneri önceki iş birliğinden. */
  suggested: boolean
  canEdit: boolean
  /** Marka için: iki onay yoksa kilitli. */
  lockedForBrand: boolean
}
