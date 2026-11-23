// iyzico ile bütün HTTP konuşması ve imzalama bu dosyada (abonelik API'si, iade/iptal, webhook imzası).
// Gizli anahtar yalnızca sunucuda (IYZICO_SECRET_KEY); hiçbir yerde loglanmaz, yanıtta dönmez.
// Kart verisi sunucumuza hiç gelmez: kart bilgisi iyzico'nun barındırdığı ödeme formunda girilir.
//
// Kaynak: docs.iyzico.com (bu oturumdan erişilemedi; uç noktalar resmi SDK'ların (iyzipay-node / iyzipay-php) davranışından
// ve dokümandaki arama özetlerinden alındı). "doğrulanacak" notlu yerler sandbox'ta ilk denemede kontrol edilmeli (docs/PAYMENTS.md).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import {
  IYZICO_PRODUCT_NAMES,
  parsePricingPlanName,
  type BillingInterval,
  type BillingRole,
  type SpotlightPlanCode,
} from '@/lib/payments/billing-shared'

export const IYZICO_SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
export const IYZICO_LIVE_URL = 'https://api.iyzipay.com'
const REQUEST_TIMEOUT_MS = 20_000

export interface IyzicoConfig {
  apiKey: string
  secretKey: string
  baseUrl: string
  mode: 'sandbox' | 'live'
  /** Webhook imzası için (iyzico panelindeki üye işyeri numarası). */
  merchantId: string | null
}

/** Ortam değişkenlerinden yapılandırma; anahtarlar yoksa null (ödeme arayüzü gizli kalır). */
export function iyzicoConfig(env: Record<string, string | undefined> = process.env): IyzicoConfig | null {
  const apiKey = env.IYZICO_API_KEY?.trim()
  const secretKey = env.IYZICO_SECRET_KEY?.trim()
  if (!apiKey || !secretKey) return null
  const baseUrl = (env.IYZICO_BASE_URL?.trim() || IYZICO_SANDBOX_URL).replace(/\/+$/, '')
  return { apiKey, secretKey, baseUrl, mode: baseUrl === IYZICO_LIVE_URL ? 'live' : 'sandbox', merchantId: env.IYZICO_MERCHANT_ID?.trim() || null }
}

/** Admin ekranı için: anahtar göstermeden mod bilgisi. */
export function iyzicoModeInfo(env: Record<string, string | undefined> = process.env) {
  const cfg = iyzicoConfig(env)
  return {
    configured: !!cfg,
    mode: cfg?.mode ?? null,
    baseUrl: cfg?.baseUrl ?? null,
    webhookSignature: !!cfg?.merchantId,
  }
}

// ---------------------------------------------------------------------------
// IYZWSv2 kimlik doğrulama başlığı (HMAC-SHA256)
// imza = hex(HMAC-SHA256(secretKey, randomKey + uriPath + body)); body GET isteklerinde boş.
// Başlık: "IYZWSv2 " + base64("apiKey:<k>&randomKey:<r>&signature:<s>"), ayrıca "x-iyzi-rnd: <r>".
// uriPath sorgu dizgisi olmadan yol (ör. /v2/subscription/products). (iyzipay-php ile aynı; doğrulanacak: sandbox'ta ilk istek)
// ---------------------------------------------------------------------------

export function uriPathOf(path: string): string {
  const q = path.indexOf('?')
  return q === -1 ? path : path.slice(0, q)
}

export function iyzicoSignature(secretKey: string, randomKey: string, path: string, body: string): string {
  return createHmac('sha256', secretKey).update(randomKey + uriPathOf(path) + body).digest('hex')
}

export function iyzicoAuthHeaders(apiKey: string, secretKey: string, path: string, body: string, randomKey: string): Record<string, string> {
  const signature = iyzicoSignature(secretKey, randomKey, path, body)
  const token = Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`, 'utf8').toString('base64')
  return { Authorization: `IYZWSv2 ${token}`, 'x-iyzi-rnd': randomKey }
}

export function newRandomKey(now: number = Date.now()): string {
  return `${now}${String(randomInt(100_000_000, 999_999_999))}`
}

// ---------------------------------------------------------------------------
// İstek
// ---------------------------------------------------------------------------

export interface IyzicoResult<T = Record<string, unknown>> {
  ok: boolean
  /** Yanıtın kendisi (status, systemTime, data, token, checkoutFormContent ...). */
  body: Record<string, unknown>
  /** body.data varsa o, yoksa body. */
  data: T
  errorCode: string | null
  errorMessage: string | null
}

export class IyzicoNotConfiguredError extends Error {
  constructor() {
    super('iyzico anahtarları tanımlı değil (IYZICO_API_KEY, IYZICO_SECRET_KEY).')
  }
}

export async function iyzicoRequest<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  payload?: Record<string, unknown>,
  cfg: IyzicoConfig | null = iyzicoConfig(),
): Promise<IyzicoResult<T>> {
  if (!cfg) throw new IyzicoNotConfiguredError()
  const body = method === 'GET' || !payload ? '' : JSON.stringify(payload)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...iyzicoAuthHeaders(cfg.apiKey, cfg.secretKey, path, body, newRandomKey()),
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, { method, headers, body: body || undefined, signal: controller.signal, cache: 'no-store' })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const ok = res.ok && json.status === 'success'
    return {
      ok,
      body: json,
      data: ((json.data && typeof json.data === 'object' ? json.data : json) as T),
      errorCode: ok ? null : String(json.errorCode ?? res.status),
      errorMessage: ok ? null : String(json.errorMessage ?? 'iyzico isteği başarısız.').slice(0, 300),
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return { ok: false, body: {}, data: {} as T, errorCode: aborted ? 'timeout' : 'network', errorMessage: aborted ? 'iyzico zaman aşımı.' : 'iyzico bağlantı hatası.' }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Ürün ve fiyatlandırma planı (abonelik)
// POST /v2/subscription/products {locale, conversationId, name, description}
// GET  /v2/subscription/products?page&count
// POST /v2/subscription/products/{productRef}/pricing-plans
//      {locale, conversationId, name, price, currencyCode, paymentInterval, paymentIntervalCount, planPaymentType}
// GET  /v2/subscription/products/{productRef}/pricing-plans?page&count
// ---------------------------------------------------------------------------

export function pricingPlanPayload(name: string, price: number, interval: BillingInterval) {
  return {
    locale: 'tr',
    conversationId: name,
    name,
    price: price.toFixed(2),
    currencyCode: 'TRY',
    paymentInterval: interval === 'yr' ? 'YEARLY' : 'MONTHLY',
    paymentIntervalCount: 1,
    planPaymentType: 'RECURRING',
  }
}

export interface IyzicoPricingPlan {
  referenceCode: string
  name: string
  price: number
  productReferenceCode: string
  paymentInterval: string | null
}

type Paged<T> = { items?: T[]; totalCount?: number; currentPage?: number; pageCount?: number }

function asItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const paged = data as Paged<T> | null
  return Array.isArray(paged?.items) ? paged!.items! : []
}

export async function listProducts(cfg: IyzicoConfig | null = iyzicoConfig()) {
  const out: Array<{ referenceCode: string; name: string }> = []
  for (let page = 1; page <= 10; page++) {
    const res = await iyzicoRequest('GET', `/v2/subscription/products?page=${page}&count=100`, undefined, cfg)
    if (!res.ok) throw new Error(`Ürünler okunamadı: ${res.errorMessage}`)
    const items = asItems<Record<string, unknown>>(res.data)
    for (const p of items) out.push({ referenceCode: String(p.referenceCode), name: String(p.name ?? '') })
    const paged = res.data as Paged<unknown>
    if (!items.length || !paged.pageCount || page >= paged.pageCount) break
  }
  return out
}

export async function listPricingPlans(productReferenceCode: string, cfg: IyzicoConfig | null = iyzicoConfig()): Promise<IyzicoPricingPlan[]> {
  const out: IyzicoPricingPlan[] = []
  for (let page = 1; page <= 10; page++) {
    const res = await iyzicoRequest('GET', `/v2/subscription/products/${encodeURIComponent(productReferenceCode)}/pricing-plans?page=${page}&count=100`, undefined, cfg)
    if (!res.ok) throw new Error(`Fiyatlandırma planları okunamadı: ${res.errorMessage}`)
    const items = asItems<Record<string, unknown>>(res.data)
    for (const p of items) {
      out.push({
        referenceCode: String(p.referenceCode),
        name: String(p.name ?? ''),
        price: Number(p.price ?? 0),
        productReferenceCode,
        paymentInterval: p.paymentInterval ? String(p.paymentInterval) : null,
      })
    }
    const paged = res.data as Paged<unknown>
    if (!items.length || !paged.pageCount || page >= paged.pageCount) break
  }
  return out
}

/** Ada göre plan haritası (önbellek 10 dk). Sunucu referans kodunu buradan bulur; sync betiği aynı adları üretir. */
let planCache: { at: number; byName: Map<string, IyzicoPricingPlan>; byRef: Map<string, IyzicoPricingPlan> } | null = null
const PLAN_CACHE_MS = 10 * 60 * 1000

export async function loadPricingPlans(cfg: IyzicoConfig | null = iyzicoConfig(), force = false) {
  if (!force && planCache && Date.now() - planCache.at < PLAN_CACHE_MS) return planCache
  const products = await listProducts(cfg)
  const wanted = new Set(Object.values(IYZICO_PRODUCT_NAMES))
  const byName = new Map<string, IyzicoPricingPlan>()
  const byRef = new Map<string, IyzicoPricingPlan>()
  for (const product of products.filter((p) => wanted.has(p.name))) {
    for (const plan of await listPricingPlans(product.referenceCode, cfg)) {
      if (!parsePricingPlanName(plan.name)) continue
      byName.set(plan.name, plan)
      byRef.set(plan.referenceCode, plan)
    }
  }
  planCache = { at: Date.now(), byName, byRef }
  return planCache
}

export function resetPricingPlanCache() {
  planCache = null
}

export function productNameForRole(role: BillingRole) {
  return IYZICO_PRODUCT_NAMES[role]
}

// ---------------------------------------------------------------------------
// Abonelik ödeme formu
// POST /v2/subscription/checkoutform/initialize → {token, checkoutFormContent, tokenExpireTime}
// GET  /v2/subscription/checkoutform/{token}     → abonelik sonucu (data.referenceCode, customerReferenceCode, subscriptionStatus …)
// ---------------------------------------------------------------------------

export interface BillingCustomerInput {
  name: string
  surname: string
  email: string
  gsmNumber: string
  /** TCKN. Kullanıcı vermezse iyzico'nun test/sabit değeri (doğrulanacak: canlıda iyzico'nun kabul ettiği değer, docs/PAYMENTS.md). */
  identityNumber: string
  city: string
  address: string
  zipCode?: string
}

/** Türkiye cep telefonu → +905xxxxxxxxx; geçersizse null. */
export function normalizeGsm(value: string): string | null {
  const digits = value.replace(/[^\d]/g, '')
  let rest = digits
  if (rest.startsWith('90')) rest = rest.slice(2)
  if (rest.startsWith('0')) rest = rest.slice(1)
  return /^5\d{9}$/.test(rest) ? `+90${rest}` : null
}

export const IYZICO_DEFAULT_IDENTITY_NUMBER = '11111111111'

export function customerPayload(c: BillingCustomerInput) {
  const contactName = `${c.name} ${c.surname}`.trim()
  const address = { contactName, city: c.city, country: 'Turkey', address: c.address, zipCode: c.zipCode || undefined }
  return {
    name: c.name,
    surname: c.surname,
    email: c.email,
    gsmNumber: c.gsmNumber,
    identityNumber: c.identityNumber || IYZICO_DEFAULT_IDENTITY_NUMBER,
    billingAddress: address,
    shippingAddress: address,
  }
}

export function checkoutInitializePayload(input: {
  conversationId: string
  callbackUrl: string
  pricingPlanReferenceCode: string
  customer: BillingCustomerInput
}) {
  return {
    locale: 'tr',
    conversationId: input.conversationId,
    callbackUrl: input.callbackUrl,
    pricingPlanReferenceCode: input.pricingPlanReferenceCode,
    subscriptionInitialStatus: 'ACTIVE',
    customer: customerPayload(input.customer),
  }
}

export async function initializeSubscriptionCheckout(input: Parameters<typeof checkoutInitializePayload>[0], cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest('POST', '/v2/subscription/checkoutform/initialize', checkoutInitializePayload(input), cfg)
  const token = typeof res.body.token === 'string' ? res.body.token : null
  const content = typeof res.body.checkoutFormContent === 'string' ? res.body.checkoutFormContent : null
  return { ok: res.ok && !!token && !!content, token, checkoutFormContent: content, errorMessage: res.errorMessage }
}

export interface IyzicoOrder {
  referenceCode: string
  price: number
  currencyCode: string
  startPeriod: string | null
  endPeriod: string | null
  orderStatus: string
  paymentId: string | null
  lastFailure: string | null
}

export interface IyzicoSubscriptionDetail {
  referenceCode: string
  parentReferenceCode: string | null
  pricingPlanReferenceCode: string | null
  customerReferenceCode: string | null
  status: string
  startDate: string | null
  endDate: string | null
  orders: IyzicoOrder[]
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Abonelik ayrıntısını sade biçime çevirir (tarihler epoch ms gelir; doğrulanacak). */
export function parseSubscriptionDetail(data: Record<string, unknown> | null | undefined): IyzicoSubscriptionDetail | null {
  if (!data || typeof data !== 'object') return null
  const ref = data.referenceCode ?? data.subscriptionReferenceCode
  if (!ref) return null
  const orders = Array.isArray(data.orders) ? (data.orders as Record<string, unknown>[]) : []
  return {
    referenceCode: String(ref),
    parentReferenceCode: data.parentReferenceCode ? String(data.parentReferenceCode) : null,
    pricingPlanReferenceCode: data.pricingPlanReferenceCode ? String(data.pricingPlanReferenceCode) : null,
    customerReferenceCode: data.customerReferenceCode ? String(data.customerReferenceCode) : null,
    status: String(data.subscriptionStatus ?? data.status ?? '').toUpperCase(),
    startDate: toIso(data.startDate),
    endDate: toIso(data.endDate),
    orders: orders.map((o) => {
      const attempts = Array.isArray(o.paymentAttempts) ? (o.paymentAttempts as Record<string, unknown>[]) : []
      const success = attempts.find((a) => String(a.paymentStatus ?? '').toUpperCase() === 'SUCCESS')
      const last = attempts[attempts.length - 1]
      return {
        referenceCode: String(o.referenceCode ?? ''),
        price: Number(o.price ?? 0),
        currencyCode: String(o.currencyCode ?? 'TRY'),
        startPeriod: toIso(o.startPeriod),
        endPeriod: toIso(o.endPeriod),
        orderStatus: String(o.orderStatus ?? '').toUpperCase(),
        paymentId: success?.paymentId ? String(success.paymentId) : last?.paymentId ? String(last.paymentId) : null,
        lastFailure: last && String(last.paymentStatus ?? '').toUpperCase() !== 'SUCCESS' ? String(last.errorMessage ?? last.paymentStatus ?? '').slice(0, 300) || null : null,
      }
    }),
  }
}

export async function retrieveCheckoutResult(token: string, cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest('GET', `/v2/subscription/checkoutform/${encodeURIComponent(token)}`, undefined, cfg)
  return { ok: res.ok, detail: res.ok ? parseSubscriptionDetail(res.data as Record<string, unknown>) : null, errorMessage: res.errorMessage }
}

export async function retrieveSubscription(referenceCode: string, cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest('GET', `/v2/subscription/subscriptions/${encodeURIComponent(referenceCode)}`, undefined, cfg)
  return { ok: res.ok, detail: res.ok ? parseSubscriptionDetail(res.data as Record<string, unknown>) : null, errorMessage: res.errorMessage }
}

/** Müşterinin abonelikleri (plan değişikliğinde yeni referansı bulmak için). GET /v2/subscription/subscriptions?customerReferenceCode=… (doğrulanacak) */
export async function searchCustomerSubscriptions(customerReferenceCode: string, cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest('GET', `/v2/subscription/subscriptions?customerReferenceCode=${encodeURIComponent(customerReferenceCode)}&page=1&count=20`, undefined, cfg)
  if (!res.ok) return { ok: false, items: [] as IyzicoSubscriptionDetail[], errorMessage: res.errorMessage }
  const items = asItems<Record<string, unknown>>(res.data).map((d) => parseSubscriptionDetail(d)).filter((d): d is IyzicoSubscriptionDetail => !!d)
  return { ok: true, items, errorMessage: null }
}

/** İptal: iyzico'da abonelik hemen iptal olur (yeni tahsilat yapılmaz); Spotlight bizde dönem sonuna kadar sürer. */
export async function cancelSubscription(referenceCode: string, cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest('POST', `/v2/subscription/subscriptions/${encodeURIComponent(referenceCode)}/cancel`, { locale: 'tr', conversationId: referenceCode }, cfg)
  return { ok: res.ok, errorMessage: res.errorMessage, errorCode: res.errorCode }
}

/**
 * Plan değişikliği. Yeni plan aynı üründe ve aynı ödeme döneminde olmalı (iyzico kuralı).
 * upgradePeriod: NOW (hemen) ya da NEXT_PERIOD (sonraki dönemde). Yanıtta yeni abonelik referansı dönebilir (doğrulanacak).
 */
export async function upgradeSubscription(
  referenceCode: string,
  newPricingPlanReferenceCode: string,
  upgradePeriod: 'NOW' | 'NEXT_PERIOD',
  cfg: IyzicoConfig | null = iyzicoConfig(),
) {
  const res = await iyzicoRequest(
    'POST',
    `/v2/subscription/subscriptions/${encodeURIComponent(referenceCode)}/upgrade`,
    { locale: 'tr', conversationId: referenceCode, newPricingPlanReferenceCode, upgradePeriod, useTrial: false, resetRecurrenceCount: false },
    cfg,
  )
  const data = res.data as Record<string, unknown>
  const newRef = data?.referenceCode && String(data.referenceCode) !== referenceCode ? String(data.referenceCode) : null
  return { ok: res.ok, newReferenceCode: newRef, errorMessage: res.errorMessage }
}

/** Başarısız dönem ödemesini yeniden dener (kart güncellendikten sonra). */
export async function retryOrder(orderReferenceCode: string, cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest('POST', '/v2/subscription/operation/retry', { locale: 'tr', conversationId: orderReferenceCode, referenceCode: orderReferenceCode }, cfg)
  return { ok: res.ok, errorMessage: res.errorMessage }
}

/** Kart güncelleme formu: POST /v2/subscription/card-update/checkoutform/initialize (doğrulanacak). */
export async function initializeCardUpdate(
  input: { conversationId: string; callbackUrl: string; customerReferenceCode: string; subscriptionReferenceCode?: string | null },
  cfg: IyzicoConfig | null = iyzicoConfig(),
) {
  const res = await iyzicoRequest(
    'POST',
    '/v2/subscription/card-update/checkoutform/initialize',
    {
      locale: 'tr',
      conversationId: input.conversationId,
      callbackUrl: input.callbackUrl,
      customerReferenceCode: input.customerReferenceCode,
      ...(input.subscriptionReferenceCode ? { subscriptionReferenceCode: input.subscriptionReferenceCode } : {}),
    },
    cfg,
  )
  const token = typeof res.body.token === 'string' ? res.body.token : null
  const content = typeof res.body.checkoutFormContent === 'string' ? res.body.checkoutFormContent : null
  return { ok: res.ok && !!content, token, checkoutFormContent: content, errorMessage: res.errorMessage }
}

// ---------------------------------------------------------------------------
// İptal / iade (admin)
// POST /payment/cancel     {locale, conversationId, paymentId, ip}            (aynı gün, tamamı)
// POST /v2/payment/refund  {locale, conversationId, paymentId, price, ip, currency} (doğrulanacak: abonelik tahsilatında paymentId ile iade)
// ---------------------------------------------------------------------------

export async function cancelPayment(paymentId: string, ip: string, cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest('POST', '/payment/cancel', { locale: 'tr', conversationId: paymentId, paymentId, ip }, cfg)
  return { ok: res.ok, errorMessage: res.errorMessage }
}

export async function refundPayment(paymentId: string, amount: number, ip: string, cfg: IyzicoConfig | null = iyzicoConfig()) {
  const res = await iyzicoRequest(
    'POST',
    '/v2/payment/refund',
    { locale: 'tr', conversationId: paymentId, paymentId, price: amount.toFixed(2), ip, currency: 'TRY' },
    cfg,
  )
  return { ok: res.ok, errorMessage: res.errorMessage }
}

// ---------------------------------------------------------------------------
// Webhook (abonelik bildirimi)
// Başlık X-IYZ-SIGNATURE-V3 (iyzico hesabında imza özelliği açılınca gelir):
//   hex(HMAC-SHA256(secretKey, merchantId + secretKey + iyziEventType + subscriptionReferenceCode + orderReferenceCode + customerReferenceCode))
// Sıra dokümandan teyit edilemedi (doğrulanacak). Bu yüzden imza tek başına yeterli sayılmaz: her bildirimde abonelik
// iyzico API'sinden yeniden okunur ve yalnızca oradaki durum işlenir (lib/payments/iyzico-flow.ts).
// ---------------------------------------------------------------------------

export interface IyzicoWebhookPayload {
  eventType: string
  subscriptionReferenceCode: string | null
  orderReferenceCode: string | null
  customerReferenceCode: string | null
  iyziReferenceCode: string | null
  eventTime: string | null
}

export function parseWebhookPayload(raw: unknown): IyzicoWebhookPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const eventType = String(r.iyziEventType ?? r.eventType ?? '').slice(0, 80)
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : typeof v === 'number' ? String(v) : null)
  const payload: IyzicoWebhookPayload = {
    eventType,
    subscriptionReferenceCode: str(r.subscriptionReferenceCode),
    orderReferenceCode: str(r.orderReferenceCode),
    customerReferenceCode: str(r.customerReferenceCode),
    iyziReferenceCode: str(r.iyziReferenceCode),
    eventTime: str(r.iyziEventTime),
  }
  if (!eventType && !payload.subscriptionReferenceCode) return null
  return payload
}

export function webhookSignature(secretKey: string, merchantId: string, p: IyzicoWebhookPayload): string {
  const message = `${merchantId}${secretKey}${p.eventType}${p.subscriptionReferenceCode ?? ''}${p.orderReferenceCode ?? ''}${p.customerReferenceCode ?? ''}`
  return createHmac('sha256', secretKey).update(message).digest('hex')
}

/** true: imza doğru; false: yanlış; null: doğrulanamadı (başlık ya da merchantId yok). */
export function verifyWebhookSignature(header: string | null, p: IyzicoWebhookPayload, cfg: IyzicoConfig | null = iyzicoConfig()): boolean | null {
  if (!header || !cfg?.merchantId) return null
  const expected = Buffer.from(webhookSignature(cfg.secretKey, cfg.merchantId, p), 'utf8')
  const got = Buffer.from(header.trim().toLowerCase(), 'utf8')
  return expected.length === got.length && timingSafeEqual(expected, got)
}

/** iyzico plan adından plan ve dönem (bilinmeyen adlar null). */
export function planOfPricingPlanName(name: string | null | undefined): { plan: SpotlightPlanCode; interval: BillingInterval; discountPercent: number | null } | null {
  return name ? parsePricingPlanName(name) : null
}
