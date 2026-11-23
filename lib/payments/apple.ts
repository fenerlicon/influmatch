// App Store (StoreKit 2) abonelik doğrulaması: imzalı işlem (JWS) zinciri, App Store Server API ve
// App Store Server Notifications V2. Harici paket yok: node:crypto (X509Certificate, ES256 doğrulama/imzalama).
//
// Güven: JWS başlığındaki x5c zinciri Apple Root CA - G3'e (SHA-256 parmak izi sabit, APPLE_ROOT_CA_SHA256 ile değiştirilebilir)
// bağlanmalı, ara sertifikada Apple WWDR (1.2.840.113635.100.6.2.1), yaprakta App Store imza (1.2.840.113635.100.6.11.1)
// uzantısı bulunmalı. API anahtarları varsa durum ayrıca App Store Server API'den okunur (asıl kaynak).
// doğrulanacak: kök parmak izi ve OID kontrolü Apple'ın sandbox'tan gelen ilk gerçek JWS'iyle (docs/PAYMENTS.md).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR.

import { X509Certificate, createPrivateKey, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto'

/** Apple Root CA - G3 SHA-256 parmak izi (https://www.apple.com/certificateauthority/). */
export const APPLE_ROOT_CA_G3_SHA256 = '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79'

// DER kodlu OID'ler (06 0A ...): uzantı sertifikanın ham baytlarında aranır.
const OID_WWDR_INTERMEDIATE = Buffer.from('060a2a864886f76364060201', 'hex')
const OID_APPSTORE_RECEIPT_SIGNING = Buffer.from('060a2a864886f76364060b01', 'hex')

export interface AppleConfig {
  issuerId: string
  keyId: string
  privateKey: string
  bundleId: string
}

export function appleConfig(env: Record<string, string | undefined> = process.env): AppleConfig | null {
  const issuerId = env.APPLE_ISSUER_ID?.trim()
  const keyId = env.APPLE_KEY_ID?.trim()
  const privateKey = env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  const bundleId = env.APPLE_BUNDLE_ID?.trim() || 'net.influmatch.app'
  if (!issuerId || !keyId || !privateKey) return null
  return { issuerId, keyId, privateKey, bundleId }
}

export function appleBundleId(env: Record<string, string | undefined> = process.env) {
  return env.APPLE_BUNDLE_ID?.trim() || 'net.influmatch.app'
}

function b64urlDecode(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export interface DecodedJws<T = Record<string, unknown>> {
  header: { alg?: string; x5c?: string[]; kid?: string }
  payload: T
  signingInput: string
  signature: Buffer
}

export function decodeJws<T = Record<string, unknown>>(jws: string): DecodedJws<T> {
  const parts = typeof jws === 'string' ? jws.split('.') : []
  if (parts.length !== 3) throw new Error('JWS biçimi geçersiz.')
  const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'))
  const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8')) as T
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: b64urlDecode(parts[2]) }
}

export interface VerifyOptions {
  rootFingerprint?: string
  now?: Date
}

/** Apple imzalı JWS'i doğrular ve yükü döner; zincir ya da imza geçersizse hata fırlatır. */
export function verifyAppleJws<T = Record<string, unknown>>(jws: string, options: VerifyOptions = {}): T {
  const decoded = decodeJws<T>(jws)
  if (decoded.header.alg !== 'ES256') throw new Error('Beklenmeyen imza algoritması.')
  const x5c = decoded.header.x5c
  if (!Array.isArray(x5c) || x5c.length < 3) throw new Error('Sertifika zinciri eksik.')
  const certs = x5c.map((c) => new X509Certificate(Buffer.from(c, 'base64')))
  const [leaf, intermediate, root] = certs
  const pinned = (options.rootFingerprint ?? process.env.APPLE_ROOT_CA_SHA256 ?? APPLE_ROOT_CA_G3_SHA256).toUpperCase()
  if (root.fingerprint256.toUpperCase() !== pinned) throw new Error('Kök sertifika Apple değil.')
  const now = (options.now ?? new Date()).getTime()
  for (const cert of certs) {
    if (new Date(cert.validFrom).getTime() > now || new Date(cert.validTo).getTime() < now) throw new Error('Sertifika süresi geçersiz.')
  }
  if (!root.verify(root.publicKey)) throw new Error('Kök sertifika kendi imzalı değil.')
  if (!intermediate.checkIssued(root) || !intermediate.verify(root.publicKey)) throw new Error('Ara sertifika kök tarafından imzalanmamış.')
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) throw new Error('Yaprak sertifika ara sertifika tarafından imzalanmamış.')
  if (!intermediate.raw.includes(OID_WWDR_INTERMEDIATE)) throw new Error('Ara sertifika Apple WWDR değil.')
  if (!leaf.raw.includes(OID_APPSTORE_RECEIPT_SIGNING)) throw new Error('Yaprak sertifika App Store imza sertifikası değil.')
  const ok = cryptoVerify('sha256', Buffer.from(decoded.signingInput), { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, decoded.signature)
  if (!ok) throw new Error('İmza geçersiz.')
  return decoded.payload
}

// ---------------------------------------------------------------------------
// Yük tipleri (yalnızca kullandığımız alanlar)
// ---------------------------------------------------------------------------

export interface AppleTransaction {
  transactionId: string
  originalTransactionId: string
  bundleId: string
  productId: string
  purchaseDate?: number
  expiresDate?: number
  revocationDate?: number
  appAccountToken?: string
  environment?: string
  price?: number
  currency?: string
}

export interface AppleRenewalInfo {
  autoRenewStatus?: number
  autoRenewProductId?: string
  gracePeriodExpiresDate?: number
  isInBillingRetryPeriod?: boolean
}

export interface AppleNotificationPayload {
  notificationType: string
  subtype?: string
  notificationUUID: string
  data?: { bundleId?: string; environment?: string; signedTransactionInfo?: string; signedRenewalInfo?: string; status?: number }
}

/**
 * App Store durum kodu (1 aktif, 2 bitti, 3 faturalama yeniden denemesi, 4 ek süre, 5 geri alındı) → bizim durum.
 * Kod yoksa işlemin bitiş tarihinden türetilir.
 */
export function appleStatusToOurs(
  statusCode: number | null,
  tx: Pick<AppleTransaction, 'expiresDate' | 'revocationDate'>,
  renewal: AppleRenewalInfo | null,
  now: Date = new Date(),
): { status: 'active' | 'past_due' | 'expired'; periodEnd: string | null; graceUntil: string | null; cancelAtPeriodEnd: boolean } {
  const periodEnd = tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null
  const cancelAtPeriodEnd = renewal?.autoRenewStatus === 0
  if (tx.revocationDate) return { status: 'expired', periodEnd, graceUntil: null, cancelAtPeriodEnd: true }
  const code = statusCode ?? (tx.expiresDate && tx.expiresDate > now.getTime() ? 1 : 2)
  if (code === 1) return { status: 'active', periodEnd, graceUntil: null, cancelAtPeriodEnd }
  if (code === 4) {
    const grace = renewal?.gracePeriodExpiresDate ? new Date(renewal.gracePeriodExpiresDate).toISOString() : periodEnd
    return { status: 'past_due', periodEnd, graceUntil: grace, cancelAtPeriodEnd }
  }
  // 3: yeniden deneme sürerken erişim yok (ek süre tanımlı değilse) → ek süre bitmiş past_due.
  if (code === 3) return { status: 'past_due', periodEnd, graceUntil: periodEnd, cancelAtPeriodEnd }
  return { status: 'expired', periodEnd, graceUntil: null, cancelAtPeriodEnd: true }
}

// ---------------------------------------------------------------------------
// App Store Server API
// ---------------------------------------------------------------------------

const APPLE_API = { production: 'https://api.storekit.itunes.apple.com', sandbox: 'https://api.storekit-sandbox.itunes.apple.com' }

/** ES256 API belirteci (en fazla 60 dk; 20 dk veriyoruz). */
export function appleApiToken(cfg: AppleConfig, now: Date = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000)
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId, typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iss: cfg.issuerId, iat, exp: iat + 20 * 60, aud: 'appstoreconnect-v1', bid: cfg.bundleId }))
  const signature = cryptoSign('sha256', Buffer.from(`${header}.${payload}`), { key: createPrivateKey(cfg.privateKey), dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${b64url(signature)}`
}

export interface AppleSubscriptionState {
  originalTransactionId: string
  statusCode: number | null
  transaction: AppleTransaction
  renewal: AppleRenewalInfo | null
  environment: string
}

/**
 * GET /inApps/v1/subscriptions/{transactionId}: aboneliğin son durumu. Önce canlı, 404'te sandbox (Apple önerisi).
 * Dönen imzalı işlemler de zincirle doğrulanır.
 */
export async function fetchAppleSubscription(transactionId: string, cfg: AppleConfig | null = appleConfig()): Promise<AppleSubscriptionState | null> {
  if (!cfg) return null
  const token = appleApiToken(cfg)
  for (const env of ['production', 'sandbox'] as const) {
    const res = await fetch(`${APPLE_API[env]}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null)
    if (!res) continue
    if (res.status === 404) continue
    if (!res.ok) throw new Error(`App Store Server API ${res.status}`)
    const body = (await res.json()) as { data?: Array<{ lastTransactions?: Array<{ originalTransactionId: string; status: number; signedTransactionInfo: string; signedRenewalInfo?: string }> }> }
    for (const group of body.data ?? []) {
      for (const last of group.lastTransactions ?? []) {
        const transaction = verifyAppleJws<AppleTransaction>(last.signedTransactionInfo)
        if (transaction.bundleId !== cfg.bundleId) continue
        const renewal = last.signedRenewalInfo ? verifyAppleJws<AppleRenewalInfo>(last.signedRenewalInfo) : null
        return { originalTransactionId: last.originalTransactionId, statusCode: last.status, transaction, renewal, environment: env }
      }
    }
  }
  return null
}
