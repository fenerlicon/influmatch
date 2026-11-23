import { getBearerUser, mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getBillingOverview } from '@/lib/payments/subscriptions'
import { STORE_PRODUCT_IDS, plansForRole } from '@/lib/payments/billing-shared'
import { storeVerificationConfigured } from '@/lib/payments/store-flow'

export const dynamic = 'force-dynamic'

/**
 * Mobil Spotlight ekranı: geçerli Spotlight hakkı (hangi kaynaktan olursa olsun), canlı ücretli abonelik ve mağazadan satın
 * alınabilir mi. Kullanıcının web'de aktif aboneliği varsa mağaza satın alması önerilmez (tek abonelik kuralı).
 */
export async function GET(request: Request) {
  const user = await getBearerUser(request)
  if (!user) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ error: 'Sunucu yapılandırması eksik.' }, 500)

  const o = await getBillingOverview(admin, user.id)
  const store = storeVerificationConfigured()
  const paid = o.livePaid
  return mobileJson({
    success: true,
    ready: o.tablesReady,
    iapEnabled: o.tablesReady && o.settings.iap_enabled,
    role: o.role,
    verified: o.verified,
    entitlement: o.entitlement ? { plan: o.entitlement.plan, expiresAt: o.entitlement.expiresAt, source: o.entitlement.source } : null,
    subscription: paid
      ? {
          id: paid.id,
          plan: paid.plan,
          interval: paid.billing_interval,
          source: paid.source,
          status: paid.status,
          currentPeriodEnd: paid.current_period_end,
          cancelAtPeriodEnd: paid.cancel_at_period_end,
        }
      : null,
    canPurchase: o.tablesReady && o.settings.iap_enabled && o.verified && !!o.role && !paid && (store.apple || store.google),
    products: o.role ? plansForRole(o.role).map((plan) => ({ plan, monthly: STORE_PRODUCT_IDS[plan].mo, yearly: STORE_PRODUCT_IDS[plan].yr })) : [],
  })
}
