// Spotlight paketleri tek yerde: fiyat (gösterim metni) ve paket özellikleri.
// Fiyatlar ve paket içerikleri iş kararıdır; değiştirmeden önce kullanıcıya sorulur.
// Listede yalnızca sistemde gerçekten çalışan özellikler yer alır (karşılığı olmayan madde yazılmaz).
// Satın alma iyzico aboneliğiyle (lib/payments/*, docs/PAYMENTS.md); satış bayrağı (payments_enabled) açılana kadar kapalı.
// Admin elle de açabilir (toggleUserSpotlight → abonelik kaydı, kaynak admin).

export type SpotlightPlanCode = 'ibasic' | 'ipro' | 'mbasic' | 'mpro'
export type BillingInterval = 'mo' | 'yr'

export const SPOTLIGHT_PLAN_PRICES: Record<SpotlightPlanCode, Record<BillingInterval, string>> = {
  ibasic: { mo: '149 ₺', yr: '1.490 ₺' },
  ipro: { mo: '299 ₺', yr: '2.990 ₺' },
  mbasic: { mo: '990 ₺', yr: '9.900 ₺' },
  mpro: { mo: '2.490 ₺', yr: '24.900 ₺' },
}

/**
 * Tahsil edilen tutarlar (TRY; gösterim metniyle aynı değer, KDV durumu muhasebeciyle netleşecek). Gösterim metniyle birlikte değişir;
 * iyzico fiyatlandırma planları bu değerlerden oluşturulur (scripts/iyzico-sync-plans.mjs bu nesneyi dosyadan okur).
 */
export const SPOTLIGHT_PLAN_AMOUNTS: Record<SpotlightPlanCode, Record<BillingInterval, number>> = {
  ibasic: { mo: 149, yr: 1490 },
  ipro: { mo: 299, yr: 2990 },
  mbasic: { mo: 990, yr: 9900 },
  mpro: { mo: 2490, yr: 24900 },
}

export interface PlanFeature {
  text: string
  highlight?: boolean
}

export const SPOTLIGHT_PLAN_FEATURES: Record<SpotlightPlanCode, PlanFeature[]> = {
  ibasic: [
    { text: 'Spotlight rozeti ve çerçevesi', highlight: true },
    { text: 'Keşfette öncelikli listeleme' },
    { text: 'Profil görüntülenme sayıları' },
    { text: 'Anlık ilan alarmı', highlight: true },
  ],
  ipro: [
    { text: 'Spotlight rozeti ve çerçevesi', highlight: true },
    { text: 'Keşfette öncelikli listeleme', highlight: true },
    { text: 'Profil görüntülenme sayıları' },
    { text: 'Anlık ilan alarmı' },
    { text: 'Portföyde iş birliği sonuçları', highlight: true },
  ],
  mbasic: [
    { text: 'Akıllı eşleştirme önerileri', highlight: true },
    { text: 'Kampanya uyum skoru' },
    { text: 'Benzer profil keşfi' },
    { text: 'İlanların topluluk listesinde öne çıkar' },
  ],
  mpro: [
    { text: 'Akıllı eşleştirme önerileri', highlight: true },
    { text: 'Kampanya uyum skoru' },
    { text: 'Benzer profil keşfi' },
    { text: 'İlanların topluluk listesinde öne çıkar' },
    { text: 'Keşifte "Verisi olanlar" ve "Mavi tikli" filtreleri', highlight: true },
    { text: 'Profillerde kampanya ROI analizi', highlight: true },
  ],
}

export function planPrice(plan: SpotlightPlanCode, interval: BillingInterval) {
  return { price: SPOTLIGHT_PLAN_PRICES[plan][interval] }
}

export function planFeatures(plan: SpotlightPlanCode) {
  return SPOTLIGHT_PLAN_FEATURES[plan]
}
