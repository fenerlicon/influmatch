'use server'

// Üyelik ve ödeme işlemleri (web). Kimlik her zaman oturumdan; sahiplik ve kurallar lib/payments/iyzico-flow.ts'te.
// İstemci tutar göndermez: fiyat sunucuda hesaplanır ve iyzico planının fiyatıyla karşılaştırılır.

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { isInterval, isPlanCode, type PriceQuote } from '@/lib/payments/billing-shared'
import {
  applyCodeToNextRenewal,
  cancelIyzicoForUser,
  changeIyzicoPlan,
  previewCheckout,
  startCardUpdate,
  startIyzicoCheckout,
  type CheckoutCustomerInput,
} from '@/lib/payments/iyzico-flow'

type Fail = { ok: false; error: string }

async function context() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const admin = createSupabaseAdminClient()
  if (!user || !admin) return null
  return { userId: user.id, admin }
}

export async function previewCheckoutAction(plan: string, interval: string, code: string | null): Promise<{ ok: true; quote: PriceQuote; codeError: string | null } | Fail> {
  const ctx = await context()
  if (!ctx) return { ok: false, error: 'Oturum açmanız gerekiyor.' }
  if (!isPlanCode(plan) || !isInterval(interval)) return { ok: false, error: 'Paket bulunamadı.' }
  const preview = await previewCheckout(ctx.admin, ctx.userId, plan, interval, code || undefined)
  return { ok: true, quote: preview.quote, codeError: preview.codeError }
}

export async function startCheckoutAction(input: {
  plan: string
  interval: string
  code: string | null
  customer: CheckoutCustomerInput
  acceptedTerms: boolean
}): Promise<{ ok: true; checkoutFormContent: string } | Fail> {
  const ctx = await context()
  if (!ctx) return { ok: false, error: 'Oturum açmanız gerekiyor.' }
  try {
    const result = await startIyzicoCheckout(ctx.admin, ctx.userId, {
      plan: input?.plan,
      interval: input?.interval,
      code: input?.code || null,
      customer: input?.customer ?? ({} as CheckoutCustomerInput),
      acceptedTerms: input?.acceptedTerms === true,
    })
    if (!result.ok) return result
    return { ok: true, checkoutFormContent: result.checkoutFormContent }
  } catch (error) {
    console.error('[billing] ödeme başlatılamadı:', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Ödeme başlatılamadı.' }
  }
}

export async function cancelSubscriptionAction(subscriptionId: string): Promise<{ ok: true; endsAt: string | null } | Fail> {
  const ctx = await context()
  if (!ctx) return { ok: false, error: 'Oturum açmanız gerekiyor.' }
  const result = await cancelIyzicoForUser(ctx.admin, ctx.userId, String(subscriptionId))
  revalidatePath('/dashboard', 'layout')
  return result
}

export async function changePlanAction(subscriptionId: string, plan: string): Promise<{ ok: true; when: 'now' | 'next_period' } | Fail> {
  const ctx = await context()
  if (!ctx) return { ok: false, error: 'Oturum açmanız gerekiyor.' }
  const result = await changeIyzicoPlan(ctx.admin, ctx.userId, String(subscriptionId), plan)
  revalidatePath('/dashboard', 'layout')
  return result
}

export async function startCardUpdateAction(subscriptionId: string): Promise<{ ok: true; checkoutFormContent: string } | Fail> {
  const ctx = await context()
  if (!ctx) return { ok: false, error: 'Oturum açmanız gerekiyor.' }
  return startCardUpdate(ctx.admin, ctx.userId, String(subscriptionId))
}

export async function applyCodeAction(subscriptionId: string, code: string): Promise<{ ok: true; percent: number } | Fail> {
  const ctx = await context()
  if (!ctx) return { ok: false, error: 'Oturum açmanız gerekiyor.' }
  const result = await applyCodeToNextRenewal(ctx.admin, ctx.userId, String(subscriptionId), code)
  revalidatePath('/dashboard', 'layout')
  return result
}
