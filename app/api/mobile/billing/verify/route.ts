import { getBearerUser, mobileJson } from '@/lib/mobile-auth'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { billingTablesReady, loadBillingSettings } from '@/lib/payments/subscriptions'
import { verifyApplePurchase, verifyGooglePurchase } from '@/lib/payments/store-flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Mağaza satın almasının sunucu doğrulaması. Gövde:
 *  - iOS: { platform: 'ios', signedTransaction } (StoreKit 2 JWS; satın almada appAccountToken = kullanıcı kimliği)
 *  - Android: { platform: 'android', purchaseToken } (satın almada obfuscatedAccountId = kullanıcı kimliği)
 * Tutar ya da plan istemciden alınmaz; ürün ve durum mağazanın imzalı / API yanıtından okunur.
 */
export async function POST(request: Request) {
  const user = await getBearerUser(request)
  if (!user) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const admin = createSupabaseAdminClient()
  if (!admin) return mobileJson({ error: 'Sunucu yapılandırması eksik.' }, 500)
  if (!(await billingTablesReady(admin)) || !(await loadBillingSettings(admin)).iap_enabled) {
    return mobileJson({ error: 'Uygulama içi satın alma henüz açık değil.' }, 403)
  }
  const body = (await request.json().catch(() => null)) as { platform?: unknown; signedTransaction?: unknown; purchaseToken?: unknown } | null
  if (!body) return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result =
    body.platform === 'ios'
      ? await verifyApplePurchase(admin, user.id, body.signedTransaction)
      : body.platform === 'android'
        ? await verifyGooglePurchase(admin, user.id, body.purchaseToken)
        : { ok: false as const, error: 'Platform geçersiz.', code: 'invalid' as const }
  if (!result.ok) return mobileJson({ error: result.error, code: result.code ?? null }, result.code === 'conflict' ? 409 : 400)
  return mobileJson({ success: true, subscriptionId: result.subscriptionId })
}
