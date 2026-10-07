// Spotlight plan fiyatları tek yerde (gösterim metni). Fiyatlar iş kararıdır; değiştirmeden önce kullanıcıya sorulur.
// Satın alma kapalı; planları admin açar (toggleUserSpotlight).

export type SpotlightPlanCode = 'ibasic' | 'ipro' | 'mbasic' | 'mpro'
export type BillingInterval = 'mo' | 'yr'

interface PlanPrice {
  price: Record<BillingInterval, string>
  originalPrice: Record<BillingInterval, string>
}

export const SPOTLIGHT_PLAN_PRICES: Record<SpotlightPlanCode, PlanPrice> = {
  ibasic: { price: { mo: '99 ₺', yr: '990 ₺' }, originalPrice: { mo: '198 ₺', yr: '1.980 ₺' } },
  ipro: { price: { mo: '199 ₺', yr: '1.990 ₺' }, originalPrice: { mo: '398 ₺', yr: '3.980 ₺' } },
  mbasic: { price: { mo: '750 ₺', yr: '7.500 ₺' }, originalPrice: { mo: '1.500 ₺', yr: '15.000 ₺' } },
  mpro: { price: { mo: '1.250 ₺', yr: '12.500 ₺' }, originalPrice: { mo: '2.500 ₺', yr: '25.000 ₺' } },
}

export function planPrice(plan: SpotlightPlanCode, interval: BillingInterval) {
  const entry = SPOTLIGHT_PLAN_PRICES[plan]
  return { price: entry.price[interval], originalPrice: entry.originalPrice[interval] }
}
