// Google Play abonelik doğrulaması: Play Developer API purchases.subscriptionsv2 ve onay (acknowledge).
// Harici paket yok: hizmet hesabı belirteci node:crypto (RS256) ile.
// Gerçek zamanlı bildirimler (RTDN, Pub/Sub push) uçta gizli anahtarla doğrulanır ve yüke güvenilmez: satın alma her seferinde
// bu API'den yeniden okunur (lib/payments/store-flow.ts).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR.

import { createPrivateKey, sign as cryptoSign } from 'node:crypto'

export interface GoogleConfig {
  clientEmail: string
  privateKey: string
  packageName: string
}

export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  try {
    const json = JSON.parse(raw) as { client_email?: string; private_key?: string }
    if (!json.client_email || !json.private_key) return null
    return { clientEmail: json.client_email, privateKey: json.private_key.replace(/\\n/g, '\n'), packageName: googlePackageName(env) }
  } catch {
    console.error('[google-play] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON okunamadı (geçersiz JSON).')
    return null
  }
}

export function googlePackageName(env: Record<string, string | undefined> = process.env) {
  return env.GOOGLE_PLAY_PACKAGE?.trim() || 'net.influmatch.app'
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function serviceAccountAssertion(cfg: GoogleConfig, now: Date = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({ iss: cfg.clientEmail, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }),
  )
  const signature = cryptoSign('RSA-SHA256', Buffer.from(`${header}.${payload}`), createPrivateKey(cfg.privateKey))
  return `${header}.${payload}.${b64url(signature)}`
}

let tokenCache: { token: string; expiresAt: number } | null = null

async function accessToken(cfg: GoogleConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceAccountAssertion(cfg) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }
  if (!res.ok || !json.access_token) throw new Error(`Google belirteci alınamadı (${res.status}).`)
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return json.access_token
}

export interface GoogleSubscriptionV2 {
  subscriptionState?: string
  latestOrderId?: string
  linkedPurchaseToken?: string
  acknowledgementState?: string
  startTime?: string
  testPurchase?: Record<string, unknown>
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string }
  lineItems?: Array<{ productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }>
}

export async function fetchGoogleSubscription(purchaseToken: string, cfg: GoogleConfig | null = googleConfig()): Promise<GoogleSubscriptionV2 | null> {
  if (!cfg) return null
  const token = await accessToken(cfg)
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(cfg.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) throw new Error(`Play Developer API ${res.status}`)
  return (await res.json()) as GoogleSubscriptionV2
}

/** Satın alma 3 gün içinde onaylanmazsa Google iade eder. */
export async function acknowledgeGoogleSubscription(productId: string, purchaseToken: string, cfg: GoogleConfig | null = googleConfig()) {
  if (!cfg) return false
  const token = await accessToken(cfg)
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(cfg.packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  return res.ok
}

/** subscriptionState → bizim durum. */
export function googleStateToOurs(
  sub: GoogleSubscriptionV2,
  now: Date = new Date(),
): { status: 'pending' | 'active' | 'past_due' | 'canceled' | 'expired'; periodEnd: string | null; graceUntil: string | null; cancelAtPeriodEnd: boolean; productId: string | null } {
  const item = sub.lineItems?.[0]
  const periodEnd = item?.expiryTime ? new Date(item.expiryTime).toISOString() : null
  const productId = item?.productId ?? null
  const autoRenew = item?.autoRenewingPlan?.autoRenewEnabled !== false
  const open = !!periodEnd && new Date(periodEnd).getTime() > now.getTime()
  switch (sub.subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return { status: 'active', periodEnd, graceUntil: null, cancelAtPeriodEnd: !autoRenew, productId }
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      // Ek sürede expiryTime ek sürenin sonudur.
      return { status: 'past_due', periodEnd, graceUntil: periodEnd, cancelAtPeriodEnd: false, productId }
    case 'SUBSCRIPTION_STATE_ON_HOLD':
      return { status: 'past_due', periodEnd, graceUntil: now.toISOString(), cancelAtPeriodEnd: false, productId }
    case 'SUBSCRIPTION_STATE_CANCELED':
      return open ? { status: 'active', periodEnd, graceUntil: null, cancelAtPeriodEnd: true, productId } : { status: 'canceled', periodEnd, graceUntil: null, cancelAtPeriodEnd: true, productId }
    case 'SUBSCRIPTION_STATE_PENDING':
      return { status: 'pending', periodEnd, graceUntil: null, cancelAtPeriodEnd: false, productId }
    default:
      // EXPIRED, PAUSED, PENDING_PURCHASE_CANCELED
      return { status: 'expired', periodEnd, graceUntil: null, cancelAtPeriodEnd: true, productId }
  }
}

/** RTDN Pub/Sub mesajının içi (base64 JSON). */
export function parseRtdnMessage(body: unknown): { messageId: string; purchaseToken: string | null; notificationType: number | null; subscriptionId: string | null; packageName: string | null; test: boolean } | null {
  const msg = (body as { message?: { data?: string; messageId?: string; message_id?: string } } | null)?.message
  if (!msg?.data) return null
  try {
    const inner = JSON.parse(Buffer.from(msg.data, 'base64').toString('utf8')) as {
      packageName?: string
      subscriptionNotification?: { notificationType?: number; purchaseToken?: string; subscriptionId?: string }
      testNotification?: unknown
    }
    return {
      messageId: String(msg.messageId ?? msg.message_id ?? ''),
      purchaseToken: inner.subscriptionNotification?.purchaseToken ?? null,
      notificationType: inner.subscriptionNotification?.notificationType ?? null,
      subscriptionId: inner.subscriptionNotification?.subscriptionId ?? null,
      packageName: inner.packageName ?? null,
      test: !!inner.testNotification,
    }
  } catch {
    return null
  }
}
