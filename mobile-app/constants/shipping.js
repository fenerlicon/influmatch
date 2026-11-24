// Barter teslimat adresi (web lib/collaboration-shipping-shared.ts ile aynı tutulmalı; tests/mobile-parity.test.ts denetler).
export const SHIPPING_LIMITS = { recipientMax: 120, addressMax: 300, districtMax: 80, cityMax: 80, noteMax: 300 };

export const SHIPPING_BRAND_LOCKED_NOTE = 'Teslimat adresi, anlaşma özeti iki tarafça onaylandıktan sonra görünür.';
export const SHIPPING_INFLUENCER_NOTE =
    'Barter iş birliğinde ürünün gönderileceği adres. Marka adresi yalnızca anlaşma özeti iki tarafça onaylandıktan sonra görür; başka kimse göremez.';
