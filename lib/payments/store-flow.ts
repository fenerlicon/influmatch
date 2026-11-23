// Mağaza içi satın alma (App Store / Google Play) → ortak abonelik kaydı (2026-11-23).
// Uygulama satın almayı yapar, sunucu doğrular (lib/payments/apple.ts, google.ts) ve aynı subscriptions tablosuna yazar;
// Spotlight aynı tek fonksiyonla (syncUserSpotlight) türetilir. Kullanıcı başına bir canlı ücretli abonelik (web ya da mağaza).
// Satın alma kullanıcıya bağlanır: iOS appAccountToken = kullanıcı kimliği, Android obfuscatedAccountId = kullanıcı kimliği.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LIVE_PAID_STATUSES,
  PLAN_LABELS,
  planFromStoreProductId,
  planMatchesRole,
  type BillingInterval,
  type SpotlightPlanCode,
  type SubscriptionStatus,
} from '@/lib/payments/billing-shared'
import {
  appleBundleId,
  appleConfig,
  appleStatusToOurs,
  fetchAppleSubscription,
  verifyAppleJws,
  type AppleNotificationPayload,
  type AppleRenewalInfo,
  type AppleTransaction,
} from '@/lib/payments/apple'
import { acknowledgeGoogleSubscription, fetchGoogleSubscription, googleConfig, googlePackageName, googleStateToOurs } from '@/lib/payments/google'
import {
  SUBSCRIPTION_COLUMNS,
  listUserSubscriptions,
  notifyBilling,
  syncUserSpotlightSafe,
  updateSubscription,
  type SubscriptionRow,
} from '@/lib/payments/subscriptions'

type Fail = { ok: false; error: string; code?: 'conflict' | 'mismatch' | 'not_configured' | 'invalid' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface StoreStateInput {
  provider: 'apple' | 'google'
  userId: string
  key: string
  plan: SpotlightPlanCode
  interval: BillingInterval
  status: SubscriptionStatus
  periodEnd: string | null
  graceUntil: string | null
  cancelAtPeriodEnd: boolean
  productId: string | null
  environment: string | null
  orderRef: string | null
  amount: number | null
  currency: string | null
  /** Google: yükseltmede eski satın alma belirteci (eski kayıt kapanır). */
  linkedKey?: string | null
}

const KEY_COLUMN = { apple: 'apple_original_transaction_id', google: 'google_purchase_token' } as const

export async function applyStoreState(admin: SupabaseClient, input: StoreStateInput): Promise<{ ok: true; subscriptionId: string } | Fail> {
  const { data: user } = await admin.from('users').select('id, role').eq('id', input.userId).maybeSingle()
  if (!user) return { ok: false, error: 'Kullanıcı bulunamadı.', code: 'invalid' }
  if (!planMatchesRole(input.plan, user.role as string)) return { ok: false, error: 'Bu paket hesap türüne uygun değil.', code: 'invalid' }

  const column = KEY_COLUMN[input.provider]
  const { data: existingData } = await admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq(column, input.key).maybeSingle()
  const existing = existingData as SubscriptionRow | null
  if (existing && existing.user_id !== input.userId) return { ok: false, error: 'Bu satın alma başka bir hesaba ait.', code: 'mismatch' }

  const now = new Date().toISOString()
  if (input.linkedKey && input.linkedKey !== input.key) {
    await admin
      .from('subscriptions')
      .update({ status: 'expired', note: 'Mağazada yeni satın almayla değişti.', updated_at: now })
      .eq(KEY_COLUMN[input.provider], input.linkedKey)
      .eq('user_id', input.userId)
  }

  const live = (LIVE_PAID_STATUSES as readonly string[]).includes(input.status)
  const patch = {
    plan: input.plan,
    billing_interval: input.interval,
    status: input.status,
    current_period_end: input.periodEnd,
    grace_until: input.status === 'past_due' ? input.graceUntil : null,
    past_due_since: input.status === 'past_due' ? existing?.past_due_since ?? now : null,
    cancel_at_period_end: input.cancelAtPeriodEnd,
    store_product_id: input.productId,
    store_environment: input.environment,
    last_synced_at: now,
  }

  let subscriptionId: string
  if (existing) {
    try {
      await updateSubscription(admin, existing.id, { ...patch, current_period_start: existing.current_period_start ?? (input.status === 'active' ? now : null) } as Partial<SubscriptionRow>)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Kaydedilemedi.' }
    }
    subscriptionId = existing.id
  } else {
    const others = (await listUserSubscriptions(admin, input.userId)) ?? []
    const conflict = others.find((r) => ['iyzico', 'apple', 'google'].includes(r.source) && ['active', 'past_due'].includes(r.status))
    const { data: inserted, error } = await admin
      .from('subscriptions')
      .insert({
        user_id: input.userId,
        source: input.provider,
        [column]: input.key,
        ...patch,
        // Çakışmada kayıt yine tutulur (admin görür) ama hak vermez.
        status: conflict && live ? 'canceled' : input.status,
        note: conflict && live ? 'Başka aktif abonelik varken mağazadan alındı; mağazadan iptal/iade gerekli.' : null,
        current_period_start: input.status === 'active' ? now : null,
      })
      .select('id')
      .single()
    if (error || !inserted) return { ok: false, error: error?.message ?? 'Kaydedilemedi.' }
    subscriptionId = inserted.id as string
    if (conflict && live) {
      await syncUserSpotlightSafe(admin, input.userId)
      return { ok: false, error: 'Zaten aktif bir aboneliğin var. Bu satın almayı mağaza ayarlarından iptal edip iade isteyebilirsin.', code: 'conflict' }
    }
  }

  if (input.orderRef && (input.status === 'active' || input.status === 'past_due')) {
    const { error } = await admin.from('payments').insert({
      subscription_id: subscriptionId,
      user_id: input.userId,
      provider: input.provider,
      provider_order_ref: input.orderRef,
      plan: input.plan,
      billing_interval: input.interval,
      amount: input.amount ?? 0,
      currency: input.currency || 'TRY',
      status: 'success',
      period_end: input.periodEnd,
      // Mağaza satışında faturayı mağaza keser (muhasebeciyle netleşecek).
      invoice_status: 'not_applicable',
    })
    if (error && error.code !== '23505') console.error('[billing] mağaza ödemesi yazılamadı:', error.message)
  }

  const prev = existing?.status ?? null
  if (prev !== input.status) {
    if (input.status === 'active' && !prev) {
      await notifyBilling(admin, input.userId, 'Spotlight aboneliğin başladı', `${PLAN_LABELS[input.plan]} aboneliğin aktif.`, 'success')
    } else if (input.status === 'past_due') {
      await notifyBilling(
        admin,
        input.userId,
        'Ödeme alınamadı',
        `Spotlight yenileme ödemen alınamadı. ${input.provider === 'apple' ? 'App Store' : 'Google Play'} ödeme yönteminini güncellersen Spotlight kesilmez.`,
        'warning',
      )
    } else if ((input.status === 'expired' || input.status === 'canceled') && prev) {
      await notifyBilling(admin, input.userId, 'Spotlight üyeliğin sona erdi', 'Mağaza aboneliğin sona erdi.', 'info')
    }
  }
  await syncUserSpotlightSafe(admin, input.userId)
  return { ok: true, subscriptionId }
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

function appleInput(userId: string, tx: AppleTransaction, statusCode: number | null, renewal: AppleRenewalInfo | null): StoreStateInput | null {
  const mapped = planFromStoreProductId(tx.productId)
  if (!mapped) return null
  const state = appleStatusToOurs(statusCode, tx, renewal)
  return {
    provider: 'apple',
    userId,
    key: tx.originalTransactionId,
    plan: mapped.plan,
    interval: mapped.interval,
    status: state.status,
    periodEnd: state.periodEnd,
    graceUntil: state.graceUntil,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    productId: tx.productId,
    environment: tx.environment ?? null,
    orderRef: tx.transactionId,
    // Apple fiyatı binde bir birimle verir (doğrulanacak: alan her işlemde gelmeyebilir).
    amount: typeof tx.price === 'number' ? Math.round(tx.price) / 1000 : null,
    currency: tx.currency ?? null,
  }
}

/** Uygulamadan gelen StoreKit 2 imzalı işlemi doğrular ve aboneliği kaydeder. */
export async function verifyApplePurchase(admin: SupabaseClient, userId: string, signedTransaction: unknown): Promise<{ ok: true; subscriptionId: string } | Fail> {
  if (typeof signedTransaction !== 'string' || signedTransaction.length > 20_000) return { ok: false, error: 'Satın alma bilgisi geçersiz.', code: 'invalid' }
  let tx: AppleTransaction
  try {
    tx = verifyAppleJws<AppleTransaction>(signedTransaction)
  } catch (error) {
    console.error('[billing] Apple JWS doğrulanamadı:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Satın alma doğrulanamadı.', code: 'invalid' }
  }
  if (tx.bundleId !== appleBundleId()) return { ok: false, error: 'Satın alma bu uygulamaya ait değil.', code: 'invalid' }
  if (!tx.appAccountToken || tx.appAccountToken.toLowerCase() !== userId.toLowerCase()) return { ok: false, error: 'Satın alma hesabınla eşleşmedi.', code: 'mismatch' }

  let statusCode: number | null = null
  let renewal: AppleRenewalInfo | null = null
  const cfg = appleConfig()
  if (cfg) {
    // Asıl kaynak App Store Server API (istemcinin gönderdiği en son işlem olmayabilir).
    const state = await fetchAppleSubscription(tx.originalTransactionId, cfg).catch((e) => {
      console.error('[billing] App Store Server API:', e instanceof Error ? e.message : e)
      return null
    })
    if (state) {
      tx = state.transaction
      statusCode = state.statusCode
      renewal = state.renewal
    }
  }
  const input = appleInput(userId, tx, statusCode, renewal)
  if (!input) return { ok: false, error: 'Ürün tanınmadı.', code: 'invalid' }
  return applyStoreState(admin, input)
}

async function recordEvent(admin: SupabaseClient, provider: 'apple' | 'google', key: string, eventType: string, payload: Record<string, unknown>) {
  const { data, error } = await admin
    .from('payment_events')
    .insert({ provider, idempotency_key: key.slice(0, 300), event_type: eventType.slice(0, 80), payload, signature_valid: true })
    .select('id')
    .maybeSingle()
  if (error?.code === '23505') return { duplicate: true as const, id: null }
  if (error) throw new Error(error.message)
  return { duplicate: false as const, id: (data?.id as string) ?? null }
}

async function finishEvent(admin: SupabaseClient, id: string | null, result: string, row?: { id: string; user_id: string } | null) {
  if (!id) return
  await admin
    .from('payment_events')
    .update({ processed_at: new Date().toISOString(), result: result.slice(0, 300), subscription_id: row?.id ?? null, user_id: row?.user_id ?? null })
    .eq('id', id)
}

/** App Store Server Notifications V2: imzalı yük doğrulanır, durum mümkünse API'den yeniden okunur. */
export async function processAppleNotification(admin: SupabaseClient, signedPayload: unknown): Promise<{ status: 'processed' | 'duplicate' | 'ignored' | 'invalid' }> {
  if (typeof signedPayload !== 'string') return { status: 'invalid' }
  let note: AppleNotificationPayload
  try {
    note = verifyAppleJws<AppleNotificationPayload>(signedPayload)
  } catch (error) {
    console.error('[billing] Apple bildirimi doğrulanamadı:', error instanceof Error ? error.message : error)
    return { status: 'invalid' }
  }
  if (note.data?.bundleId && note.data.bundleId !== appleBundleId()) return { status: 'ignored' }
  const event = await recordEvent(admin, 'apple', `apple:${note.notificationUUID}`, `${note.notificationType}${note.subtype ? `:${note.subtype}` : ''}`, {
    notificationType: note.notificationType,
    subtype: note.subtype ?? null,
    environment: note.data?.environment ?? null,
  })
  if (event.duplicate) return { status: 'duplicate' }
  if (!note.data?.signedTransactionInfo) {
    await finishEvent(admin, event.id, 'işlem bilgisi yok (TEST vb.)')
    return { status: 'ignored' }
  }
  let tx = verifyAppleJws<AppleTransaction>(note.data.signedTransactionInfo)
  let renewal = note.data.signedRenewalInfo ? verifyAppleJws<AppleRenewalInfo>(note.data.signedRenewalInfo) : null
  let statusCode = typeof note.data.status === 'number' ? note.data.status : null

  const { data: rowData } = await admin.from('subscriptions').select('id, user_id').eq('apple_original_transaction_id', tx.originalTransactionId).maybeSingle()
  const userId = (rowData?.user_id as string | undefined) ?? (tx.appAccountToken && UUID.test(tx.appAccountToken) ? tx.appAccountToken : null)
  if (!userId) {
    await finishEvent(admin, event.id, 'kullanıcı bulunamadı')
    return { status: 'ignored' }
  }
  const cfg = appleConfig()
  if (cfg) {
    const state = await fetchAppleSubscription(tx.originalTransactionId, cfg).catch(() => null)
    if (state) {
      tx = state.transaction
      renewal = state.renewal
      statusCode = state.statusCode
    }
  }
  const input = appleInput(userId, tx, statusCode, renewal)
  if (!input) {
    await finishEvent(admin, event.id, 'ürün tanınmadı')
    return { status: 'ignored' }
  }
  const res = await applyStoreState(admin, input)
  await finishEvent(admin, event.id, res.ok ? 'eşitlendi' : res.error, res.ok ? { id: res.subscriptionId, user_id: userId } : null)
  return { status: 'processed' }
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

async function googleInput(userId: string | null, purchaseToken: string): Promise<{ input: StoreStateInput | null; userId: string | null; error?: string }> {
  const cfg = googleConfig()
  if (!cfg) return { input: null, userId, error: 'Google Play doğrulaması yapılandırılmadı.' }
  const sub = await fetchGoogleSubscription(purchaseToken, cfg)
  if (!sub) return { input: null, userId, error: 'Satın alma bulunamadı.' }
  const owner = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null
  if (userId && owner && owner !== userId) return { input: null, userId, error: 'Satın alma hesabınla eşleşmedi.' }
  if (userId && !owner) return { input: null, userId, error: 'Satın alma hesabınla eşleşmedi.' }
  const resolvedUser = userId ?? (owner && UUID.test(owner) ? owner : null)
  if (!resolvedUser) return { input: null, userId: null, error: 'Kullanıcı bulunamadı.' }
  const state = googleStateToOurs(sub)
  const mapped = planFromStoreProductId(state.productId)
  if (!mapped) return { input: null, userId: resolvedUser, error: 'Ürün tanınmadı.' }
  if (state.status === 'active' && sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' && state.productId) {
    await acknowledgeGoogleSubscription(state.productId, purchaseToken, cfg).catch(() => false)
  }
  return {
    userId: resolvedUser,
    input: {
      provider: 'google',
      userId: resolvedUser,
      key: purchaseToken,
      plan: mapped.plan,
      interval: mapped.interval,
      status: state.status,
      periodEnd: state.periodEnd,
      graceUntil: state.graceUntil,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      productId: state.productId,
      environment: sub.testPurchase ? 'test' : 'production',
      orderRef: sub.latestOrderId ?? null,
      amount: null,
      currency: null,
      linkedKey: sub.linkedPurchaseToken ?? null,
    },
  }
}

export async function verifyGooglePurchase(admin: SupabaseClient, userId: string, purchaseToken: unknown): Promise<{ ok: true; subscriptionId: string } | Fail> {
  if (typeof purchaseToken !== 'string' || purchaseToken.length < 10 || purchaseToken.length > 2000) return { ok: false, error: 'Satın alma bilgisi geçersiz.', code: 'invalid' }
  const res = await googleInput(userId, purchaseToken).catch((e) => ({ input: null, userId, error: e instanceof Error ? e.message : 'Doğrulanamadı.' }))
  if (!res.input) return { ok: false, error: res.error ?? 'Satın alma doğrulanamadı.', code: 'invalid' }
  return applyStoreState(admin, res.input)
}

export async function processGoogleRtdn(
  admin: SupabaseClient,
  msg: { messageId: string; purchaseToken: string | null; notificationType: number | null; packageName: string | null; test: boolean },
): Promise<{ status: 'processed' | 'duplicate' | 'ignored' }> {
  if (msg.test || !msg.purchaseToken) return { status: 'ignored' }
  if (msg.packageName && msg.packageName !== googlePackageName()) return { status: 'ignored' }
  const event = await recordEvent(admin, 'google', `google:${msg.messageId || msg.purchaseToken}:${msg.notificationType ?? ''}`, `subscription:${msg.notificationType ?? ''}`, {
    notificationType: msg.notificationType,
  })
  if (event.duplicate) return { status: 'duplicate' }
  const { data: rowData } = await admin.from('subscriptions').select('id, user_id').eq('google_purchase_token', msg.purchaseToken).maybeSingle()
  const res = await googleInput((rowData?.user_id as string | undefined) ?? null, msg.purchaseToken).catch((e) => ({ input: null, userId: null, error: e instanceof Error ? e.message : 'hata' }))
  if (!res.input) {
    await finishEvent(admin, event.id, res.error ?? 'işlenemedi')
    return { status: 'ignored' }
  }
  const applied = await applyStoreState(admin, res.input)
  await finishEvent(admin, event.id, applied.ok ? 'eşitlendi' : applied.error, applied.ok ? { id: applied.subscriptionId, user_id: res.input.userId } : null)
  return { status: 'processed' }
}

/** Saatlik görev: dönem sonu geçmiş mağaza aboneliğini mağazadan yeniden oku (kaçan bildirim). */
export async function refreshStoreSubscription(admin: SupabaseClient, row: SubscriptionRow): Promise<boolean> {
  if (row.source === 'apple' && row.apple_original_transaction_id) {
    const cfg = appleConfig()
    if (!cfg) return false
    const state = await fetchAppleSubscription(row.apple_original_transaction_id, cfg).catch(() => null)
    if (!state) return false
    const input = appleInput(row.user_id, state.transaction, state.statusCode, state.renewal)
    if (!input) return false
    return (await applyStoreState(admin, input)).ok
  }
  if (row.source === 'google' && row.google_purchase_token) {
    const res = await googleInput(row.user_id, row.google_purchase_token).catch(() => null)
    if (!res?.input) return false
    return (await applyStoreState(admin, res.input)).ok
  }
  return false
}

export function storeVerificationConfigured() {
  return { apple: !!appleConfig(), google: !!googleConfig() }
}
