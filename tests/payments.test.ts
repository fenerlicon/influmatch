import { createHmac, createPrivateKey, sign as cryptoSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  IYZICO_PRODUCT_NAMES,
  STORE_PRODUCT_IDS,
  entitlementEnd,
  expiryNoticeDue,
  normalizeDiscountCode,
  parsePricingPlanName,
  planChangeAllowed,
  planFromStoreProductId,
  planMatchesRole,
  pricingPlanName,
  promoDiscountEligible,
  quoteFirstPeriod,
  renewalReminderDue,
  resolveEntitlement,
  type SubscriptionLike,
} from '@/lib/payments/billing-shared'
import {
  checkoutInitializePayload,
  formatIyzicoPrice,
  iyzicoAuthHeaders,
  iyzicoConfig,
  iyzicoSignature,
  normalizeGsm,
  parseSubscriptionDetail,
  parseWebhookPayload,
  uriPathOf,
  verifyWebhookSignature,
  webhookSignature,
} from '@/lib/payments/iyzico'
import { appleStatusToOurs, verifyAppleJws } from '@/lib/payments/apple'
import { googleStateToOurs, parseRtdnMessage } from '@/lib/payments/google'
import * as mobileIap from '@/mobile-app/constants/iap.js'
import {
  TEST_INTERMEDIATE_DER,
  TEST_LEAF_DER,
  TEST_LEAF_KEY_PKCS8,
  TEST_PLAIN_LEAF_DER,
  TEST_PLAIN_LEAF_KEY_PKCS8,
  TEST_ROOT_DER,
  TEST_ROOT_FINGERPRINT,
} from './fixtures/apple-test-chain'

const NOW = new Date('2027-01-15T12:00:00Z')
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * 86_400_000).toISOString()

describe('iyzico imzası ve istek gövdeleri', () => {
  it('IYZWSv2: HMAC-SHA256(secret, rnd + yol(sorgusuz) + gövde), başlık base64', () => {
    const expected = createHmac('sha256', 'gizli').update('123' + '/v2/subscription/products' + '').digest('hex')
    expect(iyzicoSignature('gizli', '123', '/v2/subscription/products?page=1&count=100', '')).toBe(expected)
    const headers = iyzicoAuthHeaders('anahtar', 'gizli', '/v2/subscription/products?page=1', '', '123')
    expect(headers['x-iyzi-rnd']).toBe('123')
    expect(headers.Authorization.startsWith('IYZWSv2 ')).toBe(true)
    const decoded = Buffer.from(headers.Authorization.slice(8), 'base64').toString('utf8')
    expect(decoded).toBe(`apiKey:anahtar&randomKey:123&signature:${expected}`)
    expect(uriPathOf('/v2/a?b=1')).toBe('/v2/a')
  })

  it('fiyat biçimi resmi SDK ile aynı', () => {
    expect(formatIyzicoPrice(149)).toBe('149.0')
    expect(formatIyzicoPrice(74.5)).toBe('74.5')
    expect(formatIyzicoPrice(1195.2)).toBe('1195.2')
  })

  it('yapılandırma: anahtar yoksa null, varsayılan sandbox', () => {
    expect(iyzicoConfig({})).toBeNull()
    expect(iyzicoConfig({ IYZICO_API_KEY: 'a', IYZICO_SECRET_KEY: 'b' })?.mode).toBe('sandbox')
    expect(iyzicoConfig({ IYZICO_API_KEY: 'a', IYZICO_SECRET_KEY: 'b', IYZICO_BASE_URL: 'https://api.iyzipay.com' })?.mode).toBe('live')
  })

  it('telefon ve ödeme formu gövdesi', () => {
    expect(normalizeGsm('0532 123 45 67')).toBe('+905321234567')
    expect(normalizeGsm('+90 532 123 4567')).toBe('+905321234567')
    expect(normalizeGsm('212 123 45 67')).toBeNull()
    const body = checkoutInitializePayload({
      conversationId: 'sid',
      callbackUrl: 'https://x/cb',
      pricingPlanReferenceCode: 'ref',
      customer: { name: 'Ada', surname: 'Yıl', email: 'a@b.c', gsmNumber: '+905321234567', identityNumber: '', city: 'İstanbul', address: 'Adres 1' },
    })
    expect(body.subscriptionInitialStatus).toBe('ACTIVE')
    expect(body.customer.identityNumber).toBe('11111111111')
    expect(body.customer.billingAddress.contactName).toBe('Ada Yıl')
    expect(JSON.stringify(body)).not.toMatch(/card/i)
  })

  it('abonelik ayrıntısı ayrıştırılır', () => {
    const detail = parseSubscriptionDetail({
      referenceCode: 'S1',
      customerReferenceCode: 'C1',
      pricingPlanReferenceCode: 'P1',
      subscriptionStatus: 'ACTIVE',
      startDate: 1767225600000,
      orders: [
        { referenceCode: 'O1', price: 149, currencyCode: 'TRY', startPeriod: 1767225600000, endPeriod: 1769904000000, orderStatus: 'SUCCESS', paymentAttempts: [{ paymentId: '99', paymentStatus: 'SUCCESS' }] },
        { referenceCode: 'O2', price: 149, startPeriod: 1769904000000, endPeriod: 1772323200000, orderStatus: 'FAILED', paymentAttempts: [{ paymentId: '100', paymentStatus: 'FAILURE', errorMessage: 'Yetersiz bakiye' }] },
      ],
    })
    expect(detail?.status).toBe('ACTIVE')
    expect(detail?.orders[0]).toMatchObject({ referenceCode: 'O1', paymentId: '99', orderStatus: 'SUCCESS' })
    expect(detail?.orders[1].lastFailure).toBe('Yetersiz bakiye')
    expect(detail?.startDate).toBe(new Date(1767225600000).toISOString())
    expect(parseSubscriptionDetail({})).toBeNull()
  })

  it('webhook imzası: doğru, yanlış, doğrulanamaz', () => {
    const payload = parseWebhookPayload({
      iyziEventType: 'subscription.order.success',
      subscriptionReferenceCode: 'S1',
      orderReferenceCode: 'O1',
      customerReferenceCode: 'C1',
      iyziEventTime: 1,
    })!
    expect(payload.eventTime).toBe('1')
    const cfg = { apiKey: 'a', secretKey: 'sk', baseUrl: 'x', mode: 'sandbox' as const, merchantId: 'm1' }
    const sig = webhookSignature('sk', 'm1', payload)
    expect(sig).toBe(createHmac('sha256', 'sk').update('m1sksubscription.order.successS1O1C1').digest('hex'))
    expect(verifyWebhookSignature(sig, payload, cfg)).toBe(true)
    expect(verifyWebhookSignature(sig.toUpperCase(), payload, cfg)).toBe(true)
    expect(verifyWebhookSignature('00', payload, cfg)).toBe(false)
    expect(verifyWebhookSignature(null, payload, cfg)).toBeNull()
    expect(verifyWebhookSignature(sig, payload, { ...cfg, merchantId: null })).toBeNull()
    expect(parseWebhookPayload(null)).toBeNull()
  })

  it('senkron betiği aynı ürün adlarını ve plan adlarını kullanır', () => {
    const script = readFileSync('scripts/iyzico-sync-plans.mjs', 'utf8')
    for (const name of Object.values(IYZICO_PRODUCT_NAMES)) expect(script).toContain(`'${name}'`)
    expect(script).toContain('`IM-${plan}-${interval}${pct ? `-D${pct}` : \'\'}`')
  })
})

describe('fiyat ve indirim kuralları', () => {
  it('indirim yoksa liste fiyatı', () => {
    expect(quoteFirstPeriod({ plan: 'ipro', interval: 'mo', promoEligible: false, codePercent: null })).toMatchObject({ amount: 299, discountKind: null })
  })
  it('ilk ay %50 yalnızca aylıkta; kod daha küçükse ertelenir', () => {
    const q = quoteFirstPeriod({ plan: 'ipro', interval: 'mo', promoEligible: true, codePercent: 20 })
    expect(q).toMatchObject({ amount: 149.5, discountKind: 'promo_first_period', discountPercent: 50, codeDeferred: true })
    expect(quoteFirstPeriod({ plan: 'mpro', interval: 'yr', promoEligible: true, codePercent: null })).toMatchObject({ amount: 24900, discountKind: null })
  })
  it('birleşmez, büyük olan geçer; yıllıkta kod', () => {
    expect(quoteFirstPeriod({ plan: 'ibasic', interval: 'mo', promoEligible: true, codePercent: 60 })).toMatchObject({ discountKind: 'task_code', discountPercent: 60, amount: 59.6 })
    expect(quoteFirstPeriod({ plan: 'mbasic', interval: 'yr', promoEligible: true, codePercent: 20 })).toMatchObject({ discountKind: 'task_code', amount: 7920 })
  })
  it('kod biçimi', () => {
    expect(normalizeDiscountCode(' im-abcd2345 ')).toBe('IM-ABCD2345')
    expect(normalizeDiscountCode('IM-123')).toBeNull()
    expect(normalizeDiscountCode(5)).toBeNull()
  })
  it('plan adları ve rol eşleşmesi', () => {
    expect(pricingPlanName('mpro', 'yr', 50)).toBe('IM-mpro-yr-D50')
    expect(parsePricingPlanName('IM-mpro-yr-D50')).toEqual({ plan: 'mpro', interval: 'yr', discountPercent: 50 })
    expect(parsePricingPlanName('IM-ibasic-mo')).toEqual({ plan: 'ibasic', interval: 'mo', discountPercent: null })
    expect(parsePricingPlanName('başka')).toBeNull()
    expect(planMatchesRole('ipro', 'influencer')).toBe(true)
    expect(planMatchesRole('mpro', 'influencer')).toBe(false)
    expect(planMatchesRole('ipro', 'admin')).toBe(false)
    expect(planChangeAllowed('ibasic', 'ipro')).toBe(true)
    expect(planChangeAllowed('ibasic', 'mpro')).toBe(false)
    expect(planChangeAllowed('ipro', 'ipro')).toBe(false)
  })
  it('ilk ay %50 hakkı: 0₺ Pro var, ücretli abonelik başlamamış, süre geçmemiş', () => {
    const promo = { source: 'promo', plan: 'ipro', status: 'expired', current_period_start: iso(-60) }
    expect(promoDiscountEligible([promo], null, NOW)).toBe(true)
    expect(promoDiscountEligible([{ ...promo, plan: 'ibasic' }], null, NOW)).toBe(false)
    expect(promoDiscountEligible([promo, { source: 'iyzico', plan: 'ipro', status: 'expired', current_period_start: null }], null, NOW)).toBe(true)
    expect(promoDiscountEligible([promo, { source: 'iyzico', plan: 'ipro', status: 'canceled', current_period_start: iso(-10) }], null, NOW)).toBe(false)
    expect(promoDiscountEligible([promo], iso(-1), NOW)).toBe(false)
  })
})

describe('Spotlight hakkı (tek kural)', () => {
  const row = (p: Partial<SubscriptionLike>): SubscriptionLike => ({ id: 'x', plan: 'ibasic', source: 'admin', status: 'active', current_period_end: iso(10), ...p })

  it('rolüne uymayan plan ve bitmiş kayıt sayılmaz', () => {
    expect(resolveEntitlement([row({ plan: 'mpro' })], 'influencer', NOW)).toBeNull()
    expect(resolveEntitlement([row({ current_period_end: iso(-1) })], 'influencer', NOW)).toBeNull()
    expect(resolveEntitlement([row({ status: 'pending', source: 'iyzico' })], 'influencer', NOW)).toBeNull()
  })
  it('Pro > Basic, sonra en geç biten; süresiz admin', () => {
    const e = resolveEntitlement([row({ id: 'a', plan: 'ibasic', current_period_end: null }), row({ id: 'b', plan: 'ipro', current_period_end: iso(3) })], 'influencer', NOW)
    expect(e).toMatchObject({ subscriptionId: 'b', plan: 'ipro' })
    expect(resolveEntitlement([row({ id: 'a', current_period_end: null }), row({ id: 'b' })], 'influencer', NOW)).toMatchObject({ subscriptionId: 'a', expiresAt: null })
  })
  it('ücretli yinelenen abonelikte dönem sonu + 3 gün, iptalde dönem sonu, ödeme alınamayınca ek süre', () => {
    expect(entitlementEnd(row({ source: 'iyzico', current_period_end: iso(1) }), NOW)).toBe(iso(4))
    expect(entitlementEnd(row({ source: 'iyzico', current_period_end: iso(1), cancel_at_period_end: true }), NOW)).toBe(iso(1))
    expect(entitlementEnd(row({ source: 'iyzico', status: 'past_due', current_period_end: iso(-1), grace_until: iso(2) }), NOW)).toBe(iso(2))
    expect(entitlementEnd(row({ source: 'iyzico', status: 'past_due', current_period_end: iso(-5), grace_until: iso(-1) }), NOW)).toBeUndefined()
    expect(entitlementEnd(row({ source: 'apple', current_period_end: null }), NOW)).toBeUndefined()
  })
  it('hatırlatmalar', () => {
    const yearly = { billing_interval: 'yr', status: 'active', cancel_at_period_end: false, current_period_end: iso(5), renewal_reminder_for: null, source: 'iyzico' }
    expect(renewalReminderDue(yearly, NOW)).toBe(true)
    expect(renewalReminderDue({ ...yearly, renewal_reminder_for: iso(5) }, NOW)).toBe(false)
    expect(renewalReminderDue({ ...yearly, billing_interval: 'mo' }, NOW)).toBe(false)
    expect(renewalReminderDue({ ...yearly, current_period_end: iso(9) }, NOW)).toBe(false)
    const promo = { status: 'active', source: 'promo', cancel_at_period_end: false, current_period_end: iso(6), expiry_notice_for: null }
    expect(expiryNoticeDue(promo, NOW)).toBe(true)
    expect(expiryNoticeDue({ ...promo, source: 'iyzico' }, NOW)).toBe(false)
    expect(expiryNoticeDue({ ...promo, source: 'iyzico', cancel_at_period_end: true }, NOW)).toBe(true)
  })
})

describe('App Store', () => {
  const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const makeJws = (payload: object, leafDer = TEST_LEAF_DER, keyB64 = TEST_LEAF_KEY_PKCS8) => {
    const header = b64url(JSON.stringify({ alg: 'ES256', x5c: [leafDer, TEST_INTERMEDIATE_DER, TEST_ROOT_DER] }))
    const body = b64url(JSON.stringify(payload))
    const key = createPrivateKey({ key: Buffer.from(keyB64, 'base64'), format: 'der', type: 'pkcs8' })
    const sig = cryptoSign('sha256', Buffer.from(`${header}.${body}`), { key, dsaEncoding: 'ieee-p1363' })
    return `${header}.${body}.${b64url(sig)}`
  }
  const opts = { rootFingerprint: TEST_ROOT_FINGERPRINT, now: NOW }
  const tx = { transactionId: '2', originalTransactionId: '1', bundleId: 'net.influmatch.app', productId: STORE_PRODUCT_IDS.ipro.mo }

  it('zincir ve imza doğrulanır', () => {
    expect(verifyAppleJws(makeJws(tx), opts)).toMatchObject(tx)
  })
  it('değiştirilmiş yük, yanlış kök ve OID\'siz yaprak reddedilir', () => {
    const jws = makeJws(tx)
    const [h, , s] = jws.split('.')
    const forged = `${h}.${b64url(JSON.stringify({ ...tx, productId: STORE_PRODUCT_IDS.mpro.yr }))}.${s}`
    expect(() => verifyAppleJws(forged, opts)).toThrow()
    expect(() => verifyAppleJws(jws, { ...opts, rootFingerprint: 'AA:BB' })).toThrow()
    expect(() => verifyAppleJws(jws, { now: NOW })).toThrow()
    expect(() => verifyAppleJws(makeJws(tx, TEST_PLAIN_LEAF_DER, TEST_PLAIN_LEAF_KEY_PKCS8), opts)).toThrow(/App Store/)
    expect(() => verifyAppleJws('a.b', opts)).toThrow()
  })
  it('durum eşlemesi', () => {
    const exp = NOW.getTime() + 86_400_000
    expect(appleStatusToOurs(1, { expiresDate: exp }, { autoRenewStatus: 0 }, NOW)).toMatchObject({ status: 'active', cancelAtPeriodEnd: true })
    expect(appleStatusToOurs(4, { expiresDate: exp }, { gracePeriodExpiresDate: exp + 1000 }, NOW).status).toBe('past_due')
    expect(appleStatusToOurs(null, { expiresDate: NOW.getTime() - 1 }, null, NOW).status).toBe('expired')
    expect(appleStatusToOurs(1, { expiresDate: exp, revocationDate: 1 }, null, NOW).status).toBe('expired')
  })
})

describe('Google Play', () => {
  it('durum eşlemesi', () => {
    const future = iso(5)
    const line = [{ productId: STORE_PRODUCT_IDS.mbasic.yr, expiryTime: future, autoRenewingPlan: { autoRenewEnabled: true } }]
    expect(googleStateToOurs({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: line }, NOW)).toMatchObject({ status: 'active', cancelAtPeriodEnd: false })
    expect(googleStateToOurs({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', lineItems: line }, NOW)).toMatchObject({ status: 'active', cancelAtPeriodEnd: true })
    expect(googleStateToOurs({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', lineItems: line }, NOW).status).toBe('past_due')
    expect(googleStateToOurs({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED', lineItems: line }, NOW).status).toBe('expired')
    expect(planFromStoreProductId(line[0].productId)).toEqual({ plan: 'mbasic', interval: 'yr' })
    expect(planFromStoreProductId('x')).toBeNull()
  })
  it('RTDN mesajı', () => {
    const data = Buffer.from(JSON.stringify({ packageName: 'net.influmatch.app', subscriptionNotification: { notificationType: 4, purchaseToken: 'tok', subscriptionId: 's' } })).toString('base64')
    expect(parseRtdnMessage({ message: { data, messageId: 'm1' } })).toMatchObject({ messageId: 'm1', purchaseToken: 'tok', notificationType: 4, test: false })
    expect(parseRtdnMessage({})).toBeNull()
  })
})

describe('web ↔ mobil mağaza ürün kimlikleri', () => {
  it('aynı', () => {
    expect(mobileIap.STORE_PRODUCT_IDS).toEqual(STORE_PRODUCT_IDS)
    expect(mobileIap.IAP_ENABLED).toBe(false)
  })
})
