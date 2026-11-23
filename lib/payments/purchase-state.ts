// Spotlight paket sayfasında "Abone ol" düğmelerinin durumu (sunucuda hesaplanır, istemciye yalnızca sonuç gider).
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR.

import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { iyzicoConfig } from '@/lib/payments/iyzico'
import { getBillingOverview } from '@/lib/payments/subscriptions'
import type { BillingInterval, SpotlightPlanCode, SubscriptionSource } from '@/lib/payments/billing-shared'

export interface PurchaseState {
  /** Satış açık, anahtarlar tanımlı, tablolar hazır, hesap doğrulanmış ve canlı ücretli abonelik yok. */
  canBuy: boolean
  /** Satış kapalıyken düğmeler "Yakında". */
  salesOpen: boolean
  verified: boolean
  /** Canlı ücretli abonelik (web ya da mağaza). */
  paid: { plan: SpotlightPlanCode; interval: BillingInterval | null; source: SubscriptionSource } | null
}

export async function getPurchaseState(userId: string): Promise<PurchaseState> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { canBuy: false, salesOpen: false, verified: false, paid: null }
  const o = await getBillingOverview(admin, userId)
  const salesOpen = o.tablesReady && o.settings.payments_enabled && !!iyzicoConfig()
  const paid = o.livePaid ? { plan: o.livePaid.plan, interval: o.livePaid.billing_interval, source: o.livePaid.source } : null
  return { canBuy: salesOpen && o.verified && !paid, salesOpen, verified: o.verified, paid }
}
