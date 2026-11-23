// iyzico abonelik akışı: ödeme formu, sonuç, yenileme / başarısız ödeme eşitlemesi, iptal, plan değişikliği,
// kart güncelleme, sonraki yenilemeye kod uygulama, admin iade / iptal.
//
// Güven kuralı: istemci tutar göndermez (fiyat sunucuda quoteFirstPeriod ile, iyzico planının fiyatıyla karşılaştırılarak);
// webhook ya da tarayıcı dönüşündeki veriye güvenilmez, abonelik her seferinde iyzico API'sinden okunup işlenir.
// Bütün ödeme yazımları service role ile. Anahtarlar loglanmaz.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAdminAlertEmail } from '@/lib/email'
import {
  PENDING_CHECKOUT_TTL_MINUTES,
  PLAN_LABELS,
  baseAmount,
  formatTry,
  graceUntil,
  isInterval,
  isPlanCode,
  isUpgrade,
  normalizeDiscountCode,
  planChangeAllowed,
  planMatchesRole,
  pricingPlanName,
  quoteFirstPeriod,
  type BillingInterval,
  type PriceQuote,
  type SpotlightPlanCode,
} from '@/lib/payments/billing-shared'
import {
  cancelPayment,
  cancelSubscription,
  initializeCardUpdate,
  initializeSubscriptionCheckout,
  iyzicoConfig,
  loadPricingPlans,
  normalizeGsm,
  planOfPricingPlanName,
  refundPayment,
  retrieveCheckoutResult,
  retrieveSubscription,
  retryOrder,
  searchCustomerSubscriptions,
  upgradeSubscription,
  type IyzicoSubscriptionDetail,
  type IyzicoWebhookPayload,
} from '@/lib/payments/iyzico'
import { issueInvoice } from '@/lib/payments/invoice'
import {
  PAYMENT_COLUMNS,
  SUBSCRIPTION_COLUMNS,
  billingTablesReady,
  findUsableCode,
  getSubscription,
  listUserSubscriptions,
  loadBillingSettings,
  markCodeUsed,
  notifyBilling,
  promoDiscountEligibleFromRows,
  releaseCode,
  reserveCode,
  syncUserSpotlightSafe,
  updateSubscription,
  type PaymentRow,
  type SubscriptionRow,
} from '@/lib/payments/subscriptions'
import { livePaidSubscription } from '@/lib/payments/billing-shared'

type Fail = { ok: false; error: string }

/** iyzico'nun tarayıcıyı geri gönderdiği adresin kökü. Önizlemede test için PAYMENTS_CALLBACK_BASE_URL (korumasız bir adres) verilebilir. */
export function paymentsCallbackBase(): string {
  return (process.env.PAYMENTS_CALLBACK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/+$/, '')
}

function trDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })
}

// ---------------------------------------------------------------------------
// Ödeme formu
// ---------------------------------------------------------------------------

export interface CheckoutCustomerInput {
  name: string
  surname: string
  gsm: string
  city: string
  address: string
  identityNumber?: string | null
}

export interface CheckoutStartInput {
  plan: unknown
  interval: unknown
  code?: unknown
  customer: CheckoutCustomerInput
  acceptedTerms: boolean
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function validateCustomer(input: CheckoutCustomerInput): { ok: true; value: CheckoutCustomerInput & { gsm: string } } | Fail {
  const name = clean(input?.name, 50)
  const surname = clean(input?.surname, 50)
  const city = clean(input?.city, 50)
  const address = clean(input?.address, 200)
  const gsm = normalizeGsm(String(input?.gsm ?? ''))
  const identityNumber = clean(input?.identityNumber, 11)
  if (!name || !surname) return { ok: false, error: 'Ad ve soyad gerekli.' }
  if (!gsm) return { ok: false, error: 'Geçerli bir cep telefonu numarası yaz (05xx xxx xx xx).' }
  if (city.length < 2) return { ok: false, error: 'Şehir gerekli.' }
  if (address.length < 5) return { ok: false, error: 'Fatura adresi gerekli.' }
  if (identityNumber && !/^[1-9]\d{10}$/.test(identityNumber)) return { ok: false, error: 'T.C. kimlik numarası 11 haneli olmalı.' }
  return { ok: true, value: { name, surname, city, address, gsm, identityNumber: identityNumber || null } }
}

export interface CheckoutPreview {
  quote: PriceQuote
  promoEligible: boolean
  codeError: string | null
}

/** Ödeme sayfasında gösterilecek fiyat (aynı kural startIyzicoCheckout'ta yeniden uygulanır). */
export async function previewCheckout(admin: SupabaseClient, userId: string, plan: SpotlightPlanCode, interval: BillingInterval, codeInput?: unknown): Promise<CheckoutPreview> {
  const [settings, rows] = await Promise.all([loadBillingSettings(admin), listUserSubscriptions(admin, userId)])
  const promoEligible = promoDiscountEligibleFromRows(rows ?? [], settings)
  let codePercent: number | null = null
  let codeError: string | null = null
  if (codeInput) {
    const code = normalizeDiscountCode(codeInput)
    const usable = code ? await findUsableCode(admin, userId, code) : null
    if (!usable) codeError = 'Kod geçersiz, sana ait değil ya da kullanılmış.'
    else codePercent = usable.percent
  }
  return { quote: quoteFirstPeriod({ plan, interval, promoEligible, codePercent }), promoEligible, codeError }
}

export async function startIyzicoCheckout(
  admin: SupabaseClient,
  userId: string,
  input: CheckoutStartInput,
): Promise<{ ok: true; subscriptionId: string; checkoutFormContent: string; quote: PriceQuote } | Fail> {
  const cfg = iyzicoConfig()
  if (!cfg) return { ok: false, error: 'Ödeme sistemi henüz yapılandırılmadı.' }
  const settings = await loadBillingSettings(admin)
  if (!settings.payments_enabled) return { ok: false, error: 'Satış henüz açılmadı.' }
  if (!(await billingTablesReady(admin))) return { ok: false, error: 'Ödeme sistemi henüz hazır değil.' }
  if (!input.acceptedTerms) return { ok: false, error: 'Devam etmek için sözleşmeleri onaylaman gerekiyor.' }
  if (!isPlanCode(input.plan) || !isInterval(input.interval)) return { ok: false, error: 'Paket bulunamadı.' }
  const plan = input.plan
  const interval = input.interval

  const { data: user } = await admin.from('users').select('id, role, verification_status, email').eq('id', userId).maybeSingle()
  if (!user?.email) return { ok: false, error: 'Hesap bilgisi okunamadı.' }
  if (!planMatchesRole(plan, user.role as string)) return { ok: false, error: 'Bu paket hesap türüne uygun değil.' }
  if (user.verification_status !== 'verified') return { ok: false, error: 'Spotlight için hesabının doğrulanmış olması gerekiyor.' }

  const customer = validateCustomer(input.customer)
  if (!customer.ok) return customer

  const rows = (await listUserSubscriptions(admin, userId)) ?? []
  if (livePaidSubscription(rows)) return { ok: false, error: 'Zaten aktif bir aboneliğin var. Değişiklik için Ayarlar > Üyelik ve ödemeler.' }

  // Yarım kalan ödeme formu (sekme kapandı vb.) düşer; ayrılmış kod serbest kalır.
  for (const pending of rows.filter((r) => r.source === 'iyzico' && r.status === 'pending')) {
    await updateSubscription(admin, pending.id, { status: 'expired', note: 'Ödeme formu tamamlanmadı.' })
    await releaseCode(admin, pending.discount_reward_id, pending.id)
  }

  const promoEligible = promoDiscountEligibleFromRows(rows, settings)
  let usable: Awaited<ReturnType<typeof findUsableCode>> = null
  if (input.code) {
    const code = normalizeDiscountCode(input.code)
    usable = code ? await findUsableCode(admin, userId, code) : null
    if (!usable) return { ok: false, error: 'Kod geçersiz, sana ait değil ya da kullanılmış.' }
  }
  const quote = quoteFirstPeriod({ plan, interval, promoEligible, codePercent: usable?.percent ?? null })

  let plans: Awaited<ReturnType<typeof loadPricingPlans>>
  try {
    plans = await loadPricingPlans(cfg)
  } catch (error) {
    console.error('[billing] iyzico planları okunamadı:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Ödeme sistemine şu an ulaşılamıyor. Biraz sonra tekrar dene.' }
  }
  const planName = pricingPlanName(plan, interval, quote.discountPercent)
  const pricingPlan = plans.byName.get(planName)
  if (!pricingPlan) {
    console.error(`[billing] iyzico planı tanımlı değil: ${planName} (scripts/iyzico-sync-plans.mjs)`)
    return { ok: false, error: 'Bu paket için ödeme şu an başlatılamıyor. Destek ekibine yazabilirsin.' }
  }
  // Fiyat koruması: iyzico'daki plan fiyatı bizim hesapladığımızla aynı olmalı.
  if (Math.abs(pricingPlan.price - quote.amount) > 0.009) {
    console.error(`[billing] plan fiyatı uyuşmuyor: ${planName} iyzico=${pricingPlan.price} beklenen=${quote.amount}`)
    return { ok: false, error: 'Bu paket için ödeme şu an başlatılamıyor. Destek ekibine yazabilirsin.' }
  }

  const { data: inserted, error: insertError } = await admin
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan,
      billing_interval: interval,
      source: 'iyzico',
      status: 'pending',
      iyzico_pricing_plan_ref: pricingPlan.referenceCode,
      discount_kind: quote.discountKind,
      discount_percent: quote.discountPercent,
      discount_code: quote.discountKind === 'task_code' ? usable?.code ?? null : null,
      discount_reward_id: quote.discountKind === 'task_code' ? usable?.rewardId ?? null : null,
      discount_state: quote.discountKind ? 'active' : null,
    })
    .select('id')
    .single()
  if (insertError || !inserted) {
    if (insertError?.code === '23505') return { ok: false, error: 'Süren bir ödeme işlemin var. Birkaç dakika sonra tekrar dene.' }
    console.error('[billing] abonelik kaydı açılamadı:', insertError?.message)
    return { ok: false, error: 'Ödeme başlatılamadı.' }
  }
  const subscriptionId = inserted.id as string

  if (quote.discountKind === 'task_code' && usable) {
    const reserved = await reserveCode(admin, usable.rewardId, subscriptionId, usable.reservedSubscriptionId)
    if (!reserved) {
      await updateSubscription(admin, subscriptionId, { status: 'expired', note: 'Kod başka bir ödemeye ayrılmış.' })
      return { ok: false, error: 'Kod şu an başka bir ödemede kullanılıyor.' }
    }
  }

  const init = await initializeSubscriptionCheckout(
    {
      conversationId: subscriptionId,
      callbackUrl: `${paymentsCallbackBase()}/api/payments/iyzico/callback?sid=${subscriptionId}`,
      pricingPlanReferenceCode: pricingPlan.referenceCode,
      customer: {
        name: customer.value.name,
        surname: customer.value.surname,
        email: user.email as string,
        gsmNumber: customer.value.gsm,
        identityNumber: customer.value.identityNumber ?? '',
        city: customer.value.city,
        address: customer.value.address,
      },
    },
    cfg,
  )
  if (!init.ok || !init.token || !init.checkoutFormContent) {
    await updateSubscription(admin, subscriptionId, { status: 'expired', note: `Form açılamadı: ${init.errorMessage ?? ''}`.slice(0, 500) })
    await releaseCode(admin, usable?.rewardId ?? null, subscriptionId)
    return { ok: false, error: 'Ödeme formu açılamadı. Bilgilerini kontrol edip tekrar dene.' }
  }
  await updateSubscription(admin, subscriptionId, { iyzico_checkout_token: init.token })
  return { ok: true, subscriptionId, checkoutFormContent: init.checkoutFormContent, quote }
}

// ---------------------------------------------------------------------------
// Form sonucu (iyzico tarayıcıyı callback adresine POST'lar; yalnızca token'a güvenip sonucu API'den okuruz)
// ---------------------------------------------------------------------------

export async function completeIyzicoCheckout(admin: SupabaseClient, token: string): Promise<{ ok: true; subscriptionId: string } | Fail> {
  if (!token || token.length > 200) return { ok: false, error: 'Geçersiz ödeme dönüşü.' }
  const { data } = await admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('iyzico_checkout_token', token).maybeSingle()
  const row = data as SubscriptionRow | null
  if (!row) return { ok: false, error: 'Ödeme kaydı bulunamadı.' }
  if (row.status === 'active' || row.status === 'past_due') return { ok: true, subscriptionId: row.id }

  const result = await retrieveCheckoutResult(token)
  if (!result.ok || !result.detail || !['ACTIVE', 'PENDING'].includes(result.detail.status)) {
    if (row.status === 'pending') {
      await updateSubscription(admin, row.id, { status: 'expired', note: `Ödeme tamamlanmadı: ${result.errorMessage ?? result.detail?.status ?? ''}`.slice(0, 500) })
      await releaseCode(admin, row.discount_reward_id, row.id)
    }
    return { ok: false, error: 'Ödeme tamamlanmadı.' }
  }

  // Ayrıntı (dönem ve tahsilatlar) abonelik ucundan.
  const full = (await retrieveSubscription(result.detail.referenceCode)).detail ?? result.detail
  const activation: Partial<SubscriptionRow> = {
    iyzico_subscription_ref: full.referenceCode,
    iyzico_customer_ref: full.customerReferenceCode ?? result.detail.customerReferenceCode,
    status: 'active',
    current_period_start: full.startDate ?? new Date().toISOString(),
  }
  try {
    await updateSubscription(admin, row.id, activation)
  } catch (error) {
    // Aynı kullanıcının başka canlı ücretli aboneliği oluşmuş (iki sekmede ödeme): yeni aboneliği hemen iptal et, admin'e bildir.
    console.error('[billing] çift abonelik:', error instanceof Error ? error.message : error)
    await cancelSubscription(full.referenceCode)
    await admin
      .from('subscriptions')
      .update({ status: 'canceled', iyzico_subscription_ref: full.referenceCode, canceled_at: new Date().toISOString(), note: 'Çift ödeme: iyzico aboneliği iptal edildi, tahsilat iade edilmeli.' })
      .eq('id', row.id)
    await sendAdminAlertEmail({
      subject: 'Influmatch: çift abonelik ödemesi (iade gerekli)',
      text: `Kullanıcı ${row.user_id} için ikinci bir ücretli abonelik oluştu ve iptal edildi (kayıt ${row.id}). /admin/billing üzerinden tahsilatı iade et.`,
    })
    return { ok: false, error: 'Zaten aktif bir aboneliğin var; bu ödeme iade edilecek.' }
  }
  const fresh = (await getSubscription(admin, row.id))!
  await applyIyzicoDetail(admin, fresh, full)
  if (row.discount_kind === 'task_code' && row.discount_reward_id) await markCodeUsed(admin, row.discount_reward_id, row.id)
  await notifyBilling(admin, row.user_id, 'Spotlight aboneliğin başladı', `${PLAN_LABELS[row.plan]} aboneliğin aktif. Üyelik ayrıntıların Ayarlar > Üyelik ve ödemeler'de.`, 'success')
  return { ok: true, subscriptionId: row.id }
}

// ---------------------------------------------------------------------------
// Eşitleme (webhook, saatlik görev, kart güncelleme sonrası)
// ---------------------------------------------------------------------------

/** iyzico'dan okunan abonelik durumunu kayda ve ödeme listesine işler; Spotlight'ı eşitler. */
export async function applyIyzicoDetail(admin: SupabaseClient, row: SubscriptionRow, detail: IyzicoSubscriptionDetail): Promise<SubscriptionRow> {
  const now = new Date()
  const cfg = iyzicoConfig()
  const plans = await loadPricingPlans(cfg).catch(() => null)
  const planName = detail.pricingPlanReferenceCode ? plans?.byRef.get(detail.pricingPlanReferenceCode)?.name : null
  const planInfo = planOfPricingPlanName(planName)
  const plan = planInfo?.plan ?? row.plan
  const interval = planInfo?.interval ?? row.billing_interval ?? 'mo'

  const byStart = (a: { startPeriod: string | null }, b: { startPeriod: string | null }) =>
    new Date(a.startPeriod ?? 0).getTime() - new Date(b.startPeriod ?? 0).getTime()
  const orders = [...detail.orders].sort(byStart)
  const successes = orders.filter((o) => o.orderStatus === 'SUCCESS')
  const latestSuccess = successes[successes.length - 1] ?? null
  const latestOrder = orders[orders.length - 1] ?? null
  const failedAfterSuccess =
    !!latestOrder && latestOrder.orderStatus === 'FAILED' && (!latestSuccess || byStart(latestOrder, latestSuccess) > 0)

  const patch: Partial<SubscriptionRow> = {
    last_synced_at: now.toISOString(),
    iyzico_subscription_ref: detail.referenceCode,
    iyzico_customer_ref: detail.customerReferenceCode ?? row.iyzico_customer_ref,
  }
  if (planInfo && planMatchesRole(plan, planRoleOf(row.plan))) {
    patch.plan = plan
    patch.billing_interval = interval
    patch.iyzico_pricing_plan_ref = detail.pricingPlanReferenceCode
    if (row.pending_plan === plan) patch.pending_plan = null
  }
  if (latestSuccess) {
    patch.current_period_start = latestSuccess.startPeriod ?? row.current_period_start
    patch.current_period_end = latestSuccess.endPeriod ?? addInterval(latestSuccess.startPeriod ?? now.toISOString(), interval)
  } else if (detail.status === 'ACTIVE' && !row.current_period_end) {
    // Sipariş listesi henüz dolmamışsa (doğrulanacak) ilk dönem başlangıçtan hesaplanır; sonraki eşitleme gerçek dönemi yazar.
    const start = detail.startDate ?? row.current_period_start ?? now.toISOString()
    patch.current_period_start = start
    patch.current_period_end = addInterval(start, interval)
  }
  const periodEnd = patch.current_period_end ?? row.current_period_end
  const periodOpen = !!periodEnd && new Date(periodEnd).getTime() > now.getTime()

  let status = row.status
  if (detail.status === 'EXPIRED') status = 'expired'
  else if (detail.status === 'CANCELED') {
    if (periodOpen && row.status !== 'past_due') {
      status = 'active'
      patch.cancel_at_period_end = true
      patch.canceled_at = row.canceled_at ?? now.toISOString()
    } else status = row.status === 'past_due' ? 'expired' : 'canceled'
  } else if (detail.status === 'UNPAID' || failedAfterSuccess) {
    status = 'past_due'
    patch.past_due_since = row.past_due_since ?? now.toISOString()
    patch.grace_until = row.grace_until ?? graceUntil(now)
  } else if (detail.status === 'ACTIVE') {
    status = latestSuccess ? 'active' : row.status
    patch.past_due_since = null
    patch.grace_until = null
  }
  patch.status = status

  // Tahsilatlar: her iyzico siparişi bir ödeme satırı (iade edilmiş satırın durumu ezilmez).
  await recordIyzicoOrders(admin, row, orders, plan, interval)

  // İndirimli dönem tahsil edildiyse sonraki dönem normal plana döner (iyzico: aynı ürün, aynı dönem, NEXT_PERIOD).
  if ((row.discount_state === 'active' || row.discount_state === 'scheduled') && latestSuccess && status === 'active') {
    const full = baseAmount(plan, interval)
    if (latestSuccess.price < full - 0.009) {
      const basePlan = plans?.byName.get(pricingPlanName(plan, interval))
      if (basePlan && patch.iyzico_subscription_ref) {
        const res = await upgradeSubscription(patch.iyzico_subscription_ref, basePlan.referenceCode, 'NEXT_PERIOD', cfg)
        if (res.ok) {
          patch.discount_state = 'done'
          if (res.newReferenceCode) patch.iyzico_subscription_ref = res.newReferenceCode
          if (row.discount_kind === 'task_code' && row.discount_reward_id) await markCodeUsed(admin, row.discount_reward_id, row.id)
        } else console.error('[billing] indirim sonrası plan dönüşü yapılamadı:', res.errorMessage)
      }
    }
  }

  await updateSubscription(admin, row.id, patch)

  if (row.status !== 'past_due' && status === 'past_due') {
    await notifyBilling(
      admin,
      row.user_id,
      'Ödeme alınamadı, kartını güncelle',
      `Spotlight yenileme ödemen alınamadı. ${trDate(patch.grace_until)} tarihine kadar Ayarlar > Üyelik ve ödemeler'den kartını güncellersen Spotlight kesilmez.`,
      'warning',
    )
  } else if (row.status === 'past_due' && status === 'active') {
    await notifyBilling(admin, row.user_id, 'Ödemen alındı', 'Spotlight yenileme ödemen alındı, üyeliğin sürüyor.', 'success')
  } else if (row.status !== status && (status === 'expired' || status === 'canceled')) {
    await notifyBilling(admin, row.user_id, 'Spotlight üyeliğin sona erdi', 'Spotlight aboneliğin sona erdi. İstediğin zaman yeniden abone olabilirsin.', 'info')
  }
  // Başarılı yenileme sessizdir (e-posta kotası); ödeme geçmişinde görünür.

  await syncUserSpotlightSafe(admin, row.user_id)
  return { ...row, ...patch } as SubscriptionRow
}

function planRoleOf(plan: SpotlightPlanCode) {
  return plan === 'mbasic' || plan === 'mpro' ? 'brand' : 'influencer'
}

function addInterval(startIso: string, interval: BillingInterval) {
  const d = new Date(startIso)
  if (interval === 'yr') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

async function recordIyzicoOrders(
  admin: SupabaseClient,
  row: SubscriptionRow,
  orders: IyzicoSubscriptionDetail['orders'],
  plan: SpotlightPlanCode,
  interval: BillingInterval,
): Promise<number> {
  const relevant = orders.filter((o) => o.referenceCode && (o.orderStatus === 'SUCCESS' || o.orderStatus === 'FAILED'))
  if (!relevant.length) return 0
  const { data: existing } = await admin
    .from('payments')
    .select('id, provider_order_ref, status')
    .eq('provider', 'iyzico')
    .in('provider_order_ref', relevant.map((o) => o.referenceCode))
  const known = new Map((existing ?? []).map((p) => [p.provider_order_ref as string, p as { id: string; status: string }]))
  const full = baseAmount(plan, interval)
  let newSuccess = 0
  for (const o of relevant) {
    const status = o.orderStatus === 'SUCCESS' ? 'success' : 'failed'
    const prev = known.get(o.referenceCode)
    const discountPercent = status === 'success' && o.price < full - 0.009 && full > 0 ? Math.round((1 - o.price / full) * 100) : null
    if (!prev) {
      const { data: inserted, error } = await admin
        .from('payments')
        .insert({
          subscription_id: row.id,
          user_id: row.user_id,
          provider: 'iyzico',
          provider_order_ref: o.referenceCode,
          provider_payment_id: o.paymentId,
          plan,
          billing_interval: interval,
          amount: o.price,
          currency: o.currencyCode || 'TRY',
          status,
          period_start: o.startPeriod,
          period_end: o.endPeriod,
          discount_percent: discountPercent,
          failure_reason: status === 'failed' ? o.lastFailure : null,
        })
        .select('id, user_id, amount, currency, provider')
        .maybeSingle()
      if (error && error.code !== '23505') console.error('[billing] ödeme yazılamadı:', error.message)
      if (inserted && status === 'success') {
        newSuccess++
        await recordInvoice(admin, inserted as Pick<PaymentRow, 'id' | 'user_id' | 'amount' | 'currency' | 'provider'>)
      }
    } else if (prev.status === 'failed' && status === 'success') {
      // Yeniden deneme başarılı oldu.
      await admin
        .from('payments')
        .update({ status: 'success', provider_payment_id: o.paymentId, failure_reason: null, updated_at: new Date().toISOString() })
        .eq('id', prev.id)
        .eq('status', 'failed')
      newSuccess++
      await recordInvoice(admin, { id: prev.id, user_id: row.user_id, amount: o.price, currency: o.currencyCode || 'TRY', provider: 'iyzico' })
    }
  }
  return newSuccess
}

async function recordInvoice(admin: SupabaseClient, payment: Pick<PaymentRow, 'id' | 'user_id' | 'amount' | 'currency' | 'provider'>) {
  try {
    const result = await issueInvoice(admin, payment)
    if (result.status !== 'pending') {
      await admin.from('payments').update({ invoice_status: result.status, invoice_ref: result.ref ?? null }).eq('id', payment.id)
    }
  } catch (error) {
    console.error('[billing] fatura kancası:', error instanceof Error ? error.message : error)
  }
}

/** Kaydı iyzico'dan okuyup işler. Plan değişikliğinde iyzico yeni referans açarsa (UPGRADED) yenisine geçer. */
export async function reconcileIyzicoSubscription(admin: SupabaseClient, row: SubscriptionRow): Promise<{ ok: boolean; error?: string }> {
  if (!row.iyzico_subscription_ref) return { ok: false, error: 'iyzico referansı yok.' }
  const res = await retrieveSubscription(row.iyzico_subscription_ref)
  if (!res.ok || !res.detail) {
    await admin.from('subscriptions').update({ last_synced_at: new Date().toISOString() }).eq('id', row.id)
    return { ok: false, error: res.errorMessage ?? 'Abonelik okunamadı.' }
  }
  let detail = res.detail
  if (detail.status === 'UPGRADED' && row.iyzico_customer_ref) {
    const search = await searchCustomerSubscriptions(row.iyzico_customer_ref)
    const next =
      search.items.find((i) => i.parentReferenceCode === row.iyzico_subscription_ref) ??
      search.items.find((i) => ['ACTIVE', 'UNPAID', 'PENDING'].includes(i.status) && i.referenceCode !== row.iyzico_subscription_ref)
    if (next) detail = (await retrieveSubscription(next.referenceCode)).detail ?? next
  }
  await applyIyzicoDetail(admin, row, detail)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Kullanıcı işlemleri (sahiplik burada kontrol edilir)
// ---------------------------------------------------------------------------

async function ownIyzicoSubscription(admin: SupabaseClient, userId: string, subscriptionId: string): Promise<SubscriptionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)) return null
  const row = await getSubscription(admin, subscriptionId)
  if (!row || row.user_id !== userId || row.source !== 'iyzico' || !row.iyzico_subscription_ref) return null
  return row
}

/** Kullanıcı iptali: iyzico'da yeni tahsilat durur, Spotlight dönem sonuna kadar sürer. Ödemesi alınamamış abonelik hemen biter. */
export async function cancelIyzicoForUser(admin: SupabaseClient, userId: string, subscriptionId: string): Promise<{ ok: true; endsAt: string | null } | Fail> {
  const row = await ownIyzicoSubscription(admin, userId, subscriptionId)
  if (!row || !['active', 'past_due'].includes(row.status)) return { ok: false, error: 'Abonelik bulunamadı.' }
  if (row.cancel_at_period_end) return { ok: true, endsAt: row.current_period_end }
  const res = await cancelSubscription(row.iyzico_subscription_ref!)
  if (!res.ok) {
    console.error('[billing] iyzico iptali başarısız:', res.errorCode, res.errorMessage)
    return { ok: false, error: 'İptal şu an yapılamadı. Biraz sonra tekrar dene.' }
  }
  const now = new Date().toISOString()
  if (row.status === 'past_due') {
    await updateSubscription(admin, row.id, { status: 'canceled', canceled_at: now, cancel_at_period_end: true, current_period_end: now })
  } else {
    await updateSubscription(admin, row.id, { cancel_at_period_end: true, canceled_at: now, pending_plan: null })
  }
  await releaseCode(admin, row.discount_state === 'scheduled' ? row.discount_reward_id : null, row.id)
  await syncUserSpotlightSafe(admin, userId)
  const endsAt = row.status === 'past_due' ? now : row.current_period_end
  await notifyBilling(
    admin,
    userId,
    'Aboneliğin iptal edildi',
    row.status === 'past_due' ? 'Spotlight aboneliğin iptal edildi.' : `Yeni ödeme alınmayacak. Spotlight ${trDate(endsAt)} tarihine kadar açık kalır.`,
  )
  return { ok: true, endsAt }
}

/** Basic ↔ Pro (aynı rol, aynı dönem). Yükseltme hemen, düşürme sonraki dönemde. */
export async function changeIyzicoPlan(admin: SupabaseClient, userId: string, subscriptionId: string, newPlan: unknown): Promise<{ ok: true; when: 'now' | 'next_period' } | Fail> {
  const row = await ownIyzicoSubscription(admin, userId, subscriptionId)
  if (!row || row.status !== 'active' || row.cancel_at_period_end) return { ok: false, error: 'Aktif bir abonelik bulunamadı.' }
  if (!isPlanCode(newPlan) || !planChangeAllowed(row.plan, newPlan)) return { ok: false, error: 'Bu pakete geçilemez.' }
  if (row.discount_state === 'active' || row.discount_state === 'scheduled') {
    return { ok: false, error: 'İndirimli dönem bitmeden paket değiştirilemez.' }
  }
  const interval = row.billing_interval ?? 'mo'
  const cfg = iyzicoConfig()
  const plans = await loadPricingPlans(cfg).catch(() => null)
  const target = plans?.byName.get(pricingPlanName(newPlan, interval))
  if (!target) return { ok: false, error: 'Paket değişikliği şu an yapılamıyor.' }
  const when = isUpgrade(row.plan, newPlan) ? 'NOW' : 'NEXT_PERIOD'
  const res = await upgradeSubscription(row.iyzico_subscription_ref!, target.referenceCode, when, cfg)
  if (!res.ok) {
    console.error('[billing] plan değişikliği başarısız:', res.errorMessage)
    return { ok: false, error: 'Paket değişikliği şu an yapılamadı.' }
  }
  if (res.newReferenceCode) await updateSubscription(admin, row.id, { iyzico_subscription_ref: res.newReferenceCode })
  if (when === 'NOW') {
    const fresh = (await getSubscription(admin, row.id))!
    await reconcileIyzicoSubscription(admin, fresh)
  } else {
    await updateSubscription(admin, row.id, { pending_plan: newPlan })
  }
  await notifyBilling(
    admin,
    userId,
    'Paketin değişiyor',
    when === 'NOW' ? `Aboneliğin ${PLAN_LABELS[newPlan]} paketine geçti.` : `Bir sonraki dönemden itibaren ${PLAN_LABELS[newPlan]} paketine geçeceksin.`,
  )
  return { ok: true, when: when === 'NOW' ? 'now' : 'next_period' }
}

export async function startCardUpdate(admin: SupabaseClient, userId: string, subscriptionId: string): Promise<{ ok: true; checkoutFormContent: string } | Fail> {
  const row = await ownIyzicoSubscription(admin, userId, subscriptionId)
  if (!row || !row.iyzico_customer_ref || !['active', 'past_due'].includes(row.status)) return { ok: false, error: 'Abonelik bulunamadı.' }
  const res = await initializeCardUpdate({
    conversationId: row.id,
    callbackUrl: `${paymentsCallbackBase()}/api/payments/iyzico/card-callback?sid=${row.id}&sig=${cardCallbackSignature(row.id)}`,
    customerReferenceCode: row.iyzico_customer_ref,
    subscriptionReferenceCode: row.iyzico_subscription_ref,
  })
  if (!res.ok || !res.checkoutFormContent) return { ok: false, error: 'Kart güncelleme formu açılamadı.' }
  return { ok: true, checkoutFormContent: res.checkoutFormContent }
}

/** Kart güncelleme dönüş adresindeki imza: dönüş adresi tahmin edilerek başkasının ödemesi yeniden denetilemez. */
export function cardCallbackSignature(subscriptionId: string): string {
  const key = process.env.IYZICO_SECRET_KEY || process.env.CRON_SECRET || ''
  return createHmac('sha256', key).update(`card-update:${subscriptionId}`).digest('hex').slice(0, 32)
}

export function verifyCardCallbackSignature(subscriptionId: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = Buffer.from(cardCallbackSignature(subscriptionId))
  const got = Buffer.from(signature)
  return expected.length === got.length && timingSafeEqual(expected, got)
}

/** Kart güncellendikten sonra: abonelik okunur; ödemesi alınamamışsa son başarısız ödeme yeniden denenir (10 dakikada en fazla bir kez). */
export async function afterCardUpdate(admin: SupabaseClient, subscriptionId: string) {
  const row = await getSubscription(admin, subscriptionId)
  if (!row || row.source !== 'iyzico' || !row.iyzico_subscription_ref) return
  await reconcileIyzicoSubscription(admin, row)
  const fresh = await getSubscription(admin, subscriptionId)
  if (fresh?.status !== 'past_due') return
  const detail = (await retrieveSubscription(fresh.iyzico_subscription_ref!)).detail
  const failed = detail?.orders.filter((o) => o.orderStatus === 'FAILED').pop()
  if (failed) {
    // Aynı siparişi 10 dakikada en fazla bir kez yeniden dene (payment_events benzersiz anahtarı kilit olarak).
    const { error: lockError } = await admin.from('payment_events').insert({
      provider: 'iyzico',
      idempotency_key: `iyzico:retry:${failed.referenceCode}:${Math.floor(Date.now() / 600_000)}`,
      event_type: 'card_update_retry',
      subscription_id: fresh.id,
      user_id: fresh.user_id,
      payload: { orderReferenceCode: failed.referenceCode },
    })
    if (lockError) return
    const retry = await retryOrder(failed.referenceCode)
    if (!retry.ok) console.error('[billing] yeniden deneme başarısız:', retry.errorMessage)
    await reconcileIyzicoSubscription(admin, fresh)
  }
}

/** Görev kodu sonraki yenilemeye: abonelik sonraki dönem indirimli plana geçer, tahsilattan sonra normal plana döner. */
export async function applyCodeToNextRenewal(admin: SupabaseClient, userId: string, subscriptionId: string, codeInput: unknown): Promise<{ ok: true; percent: number } | Fail> {
  const row = await ownIyzicoSubscription(admin, userId, subscriptionId)
  if (!row || row.status !== 'active' || row.cancel_at_period_end) return { ok: false, error: 'Aktif bir abonelik bulunamadı.' }
  if (row.pending_plan) return { ok: false, error: 'Paket değişikliği beklerken kod kullanılamaz.' }
  if (row.discount_state === 'active' || row.discount_state === 'scheduled') return { ok: false, error: 'Bu abonelikte zaten bir indirim uygulanıyor.' }
  const code = normalizeDiscountCode(codeInput)
  const usable = code ? await findUsableCode(admin, userId, code) : null
  if (!usable) return { ok: false, error: 'Kod geçersiz, sana ait değil ya da kullanılmış.' }
  const interval = row.billing_interval ?? 'mo'
  const cfg = iyzicoConfig()
  const plans = await loadPricingPlans(cfg).catch(() => null)
  const target = plans?.byName.get(pricingPlanName(row.plan, interval, usable.percent))
  if (!target) return { ok: false, error: 'Bu kod için indirimli ödeme şu an tanımlı değil. Destek ekibine yazabilirsin.' }
  if (!(await reserveCode(admin, usable.rewardId, row.id, usable.reservedSubscriptionId))) return { ok: false, error: 'Kod şu an kullanılamıyor.' }
  const res = await upgradeSubscription(row.iyzico_subscription_ref!, target.referenceCode, 'NEXT_PERIOD', cfg)
  if (!res.ok) {
    await releaseCode(admin, usable.rewardId, row.id)
    return { ok: false, error: 'Kod şu an uygulanamadı.' }
  }
  await updateSubscription(admin, row.id, {
    discount_kind: 'task_code',
    discount_percent: usable.percent,
    discount_code: usable.code,
    discount_reward_id: usable.rewardId,
    discount_state: 'scheduled',
    ...(res.newReferenceCode ? { iyzico_subscription_ref: res.newReferenceCode } : {}),
  })
  return { ok: true, percent: usable.percent }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export async function processIyzicoWebhook(
  admin: SupabaseClient,
  payload: IyzicoWebhookPayload,
  signatureValid: boolean | null,
): Promise<{ status: 'processed' | 'duplicate' | 'ignored' | 'unknown'; detail?: string }> {
  // Önce bizdeki abonelik bulunur: tanımadığımız referanslar için kayıt bile açılmaz (imzasız sahte istekle tablo şişirilemez).
  let row: SubscriptionRow | null = null
  if (payload.subscriptionReferenceCode) {
    const { data } = await admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('iyzico_subscription_ref', payload.subscriptionReferenceCode).maybeSingle()
    row = data as SubscriptionRow | null
  }
  if (!row && payload.customerReferenceCode) {
    const { data } = await admin
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('iyzico_customer_ref', payload.customerReferenceCode)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    row = data as SubscriptionRow | null
  }
  if (!row) return { status: 'unknown' }

  const key = `iyzico:${payload.eventType}:${payload.orderReferenceCode ?? payload.iyziReferenceCode ?? payload.subscriptionReferenceCode}:${payload.eventTime ?? ''}`.slice(0, 300)
  const { data: event, error } = await admin
    .from('payment_events')
    .insert({
      provider: 'iyzico',
      idempotency_key: key,
      event_type: payload.eventType,
      subscription_id: row.id,
      user_id: row.user_id,
      // En aza indirilmiş yük: yalnızca referanslar.
      payload: {
        subscriptionReferenceCode: payload.subscriptionReferenceCode,
        orderReferenceCode: payload.orderReferenceCode,
        customerReferenceCode: payload.customerReferenceCode,
        iyziReferenceCode: payload.iyziReferenceCode,
        eventTime: payload.eventTime,
      },
      signature_valid: signatureValid,
    })
    .select('id')
    .maybeSingle()
  if (error?.code === '23505') return { status: 'duplicate' }
  if (error) throw new Error(`Bildirim kaydedilemedi: ${error.message}`)
  const eventId = event?.id as string | undefined

  const finish = async (result: string) => {
    if (!eventId) return
    await admin.from('payment_events').update({ processed_at: new Date().toISOString(), result: result.slice(0, 300) }).eq('id', eventId)
  }

  // Yanlış imzalı bildirim işlenmez (saatlik eşitleme gerçek durumu zaten yakalar).
  if (signatureValid === false) {
    await finish('imza geçersiz, işlenmedi')
    return { status: 'ignored', detail: 'signature' }
  }
  // Yükteki duruma güvenilmez: abonelik iyzico'dan yeniden okunur.
  const result = await reconcileIyzicoSubscription(admin, row)
  await finish(result.ok ? 'eşitlendi' : `eşitlenemedi: ${result.error ?? ''}`)
  return { status: 'processed' }
}

// ---------------------------------------------------------------------------
// Admin: iade / iptal kaydı
// ---------------------------------------------------------------------------

export async function refundIyzicoPaymentAsAdmin(
  admin: SupabaseClient,
  adminUserId: string,
  paymentId: string,
  input: { mode: 'cancel' | 'refund'; amount?: number | null; note: string; ip: string },
): Promise<{ ok: true } | Fail> {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return { ok: false, error: 'Ödeme bulunamadı.' }
  const { data } = await admin.from('payments').select(PAYMENT_COLUMNS).eq('id', paymentId).maybeSingle()
  const payment = data as PaymentRow | null
  if (!payment || payment.provider !== 'iyzico') return { ok: false, error: 'Yalnızca kartla (iyzico) alınan ödemeler buradan iade edilir; mağaza iadeleri mağaza panelinden.' }
  if (!['success', 'partially_refunded'].includes(payment.status) || !payment.provider_payment_id) return { ok: false, error: 'Bu ödeme iade edilemez.' }
  const note = input.note.trim().slice(0, 500)
  if (note.length < 3) return { ok: false, error: 'İade nedeni gerekli.' }
  const already = Number(payment.refunded_amount ?? 0)
  const remaining = Math.round((Number(payment.amount) - already) * 100) / 100
  const now = new Date().toISOString()

  if (input.mode === 'cancel') {
    if (already > 0) return { ok: false, error: 'Kısmi iadesi olan ödeme iptal edilemez.' }
    const res = await cancelPayment(payment.provider_payment_id, input.ip)
    if (!res.ok) return { ok: false, error: `iyzico: ${res.errorMessage ?? 'iptal başarısız'}` }
    await admin
      .from('payments')
      .update({ status: 'canceled', refunded_amount: payment.amount, refunded_at: now, refund_note: note, refunded_by: adminUserId, updated_at: now })
      .eq('id', payment.id)
    return { ok: true }
  }
  const amount = Math.round(Number(input.amount ?? remaining) * 100) / 100
  if (!(amount > 0) || amount > remaining) return { ok: false, error: `İade tutarı 0 ile ${formatTry(remaining)} arasında olmalı.` }
  const res = await refundPayment(payment.provider_payment_id, amount, input.ip)
  if (!res.ok) return { ok: false, error: `iyzico: ${res.errorMessage ?? 'iade başarısız'}` }
  const total = Math.round((already + amount) * 100) / 100
  await admin
    .from('payments')
    .update({
      status: total >= Number(payment.amount) - 0.009 ? 'refunded' : 'partially_refunded',
      refunded_amount: total,
      refunded_at: now,
      refund_note: note,
      refunded_by: adminUserId,
      updated_at: now,
    })
    .eq('id', payment.id)
  return { ok: true }
}

/**
 * Saatlik görev için: süresi geçen ödeme formları. Önce iyzico'ya sorulur (kullanıcı ödeyip sekmeyi kapatmış olabilir):
 * tamamlanmışsa abonelik açılır, değilse kayıt düşer ve ayrılmış kod serbest kalır.
 */
export async function expireStalePendingCheckouts(admin: SupabaseClient, options: { limit?: number; deadline?: number } = {}, now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - PENDING_CHECKOUT_TTL_MINUTES * 60_000).toISOString()
  const { data } = await admin
    .from('subscriptions')
    .select('id, iyzico_checkout_token, discount_reward_id')
    .eq('source', 'iyzico')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(options.limit ?? 10)
  let completed = 0
  let expired = 0
  for (const r of data ?? []) {
    if (options.deadline && Date.now() > options.deadline) break
    if (r.iyzico_checkout_token) {
      const res = await completeIyzicoCheckout(admin, r.iyzico_checkout_token as string)
      if (res.ok) {
        completed++
        continue
      }
    }
    const { data: still } = await admin
      .from('subscriptions')
      .update({ status: 'expired', note: 'Ödeme formu tamamlanmadı.', updated_at: new Date().toISOString() })
      .eq('id', r.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (still) {
      expired++
      await releaseCode(admin, r.discount_reward_id as string | null, r.id as string)
    }
  }
  return { completed, expired }
}
