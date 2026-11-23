'use server'

// Admin: ödemeler ve abonelikler. Rol her çağrıda DB'den kontrol edilir; yazımlar service role ile.

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { isPaidSource, isPlanCode, planMatchesRole, DAY_MS } from '@/lib/payments/billing-shared'
import {
  endFreeSubscriptions,
  getSubscription,
  grantSubscription,
  saveBillingSetting,
  syncUserSpotlight,
  updateSubscription,
  type BillingSettingKey,
} from '@/lib/payments/subscriptions'
import { cancelIyzicoForUser, reconcileIyzicoSubscription, refundIyzicoPaymentAsAdmin } from '@/lib/payments/iyzico-flow'
import { refreshStoreSubscription } from '@/lib/payments/store-flow'
import { sweepPromoGrants, updatePromoEnd } from '@/lib/payments/billing-jobs'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return null
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  return { adminUserId: user.id, admin }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function done(message?: string): Result {
  revalidatePath('/admin/billing')
  return { ok: true, message }
}

export async function setBillingFlagAction(key: 'payments_enabled' | 'iap_enabled', value: boolean): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  if (key !== 'payments_enabled' && key !== 'iap_enabled') return { ok: false, error: 'Geçersiz ayar.' }
  await saveBillingSetting(ctx.admin, ctx.adminUserId, key as BillingSettingKey, value === true)
  return done(value ? 'Açıldı.' : 'Kapatıldı.')
}

/** 0₺ dönemi bitişi (satış başlangıcı) ya da ilk ay %50 son günü. Boş = belirlenmemiş. */
export async function setPromoDateAction(key: 'promo_ends_at' | 'promo_discount_until', value: string | null): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  if (key !== 'promo_ends_at' && key !== 'promo_discount_until') return { ok: false, error: 'Geçersiz ayar.' }
  let iso: string | null = null
  if (value) {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Tarih geçersiz.' }
    iso = d.toISOString()
  }
  await saveBillingSetting(ctx.admin, ctx.adminUserId, key, iso)
  if (key === 'promo_ends_at' && iso) {
    const users = await updatePromoEnd(ctx.admin, iso)
    for (const userId of users.slice(0, 300)) await syncUserSpotlight(ctx.admin, userId).catch(() => null)
    return done(`Kaydedildi; ${users.length} 0₺ üyeliğinin bitişi güncellendi.${users.length > 300 ? ' Kalanların Spotlight alanı saatlik görevde eşitlenir.' : ''}`)
  }
  return done('Kaydedildi.')
}

export async function runPromoSweepAction(): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  const res = await sweepPromoGrants(ctx.admin, { limit: 1000, deadline: Date.now() + 40_000 })
  if ('skipped' in res && res.skipped) return { ok: false, error: '0₺ dönemi anahtarı (/admin/tasks) kapalı ya da bitiş tarihi girilmemiş / geçmiş.' }
  return done(`${res.granted} hesaba 0₺ Pro verildi. Kalan varsa tekrar bas ya da saatlik görevi bekle.`)
}

export async function grantSpotlightAction(input: { user: string; plan: string; months: number; note: string }): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  const q = String(input.user ?? '').trim().replace(/^@/, '')
  if (!q) return { ok: false, error: 'Kullanıcı gerekli.' }
  const query = ctx.admin.from('users').select('id, role')
  const { data: user } = await (UUID.test(q) ? query.eq('id', q) : q.includes('@') ? query.ilike('email', q) : query.ilike('username', q)).maybeSingle()
  if (!user) return { ok: false, error: 'Kullanıcı bulunamadı.' }
  if (!isPlanCode(input.plan) || !planMatchesRole(input.plan, user.role as string)) return { ok: false, error: 'Paket kullanıcının rolüne uymuyor.' }
  const months = Math.floor(Number(input.months))
  if (!(months >= 0 && months <= 36)) return { ok: false, error: 'Süre 0–36 ay olmalı (0 = süresiz).' }
  let end: string | null = null
  if (months > 0) {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    end = d.toISOString()
  }
  const res = await grantSubscription(ctx.admin, {
    userId: user.id as string,
    plan: input.plan,
    source: 'admin',
    end,
    note: String(input.note ?? '').slice(0, 300) || 'Admin tanımı',
    createdBy: ctx.adminUserId,
  })
  if (!res.ok) return { ok: false, error: res.error }
  return done('Spotlight tanımlandı.')
}

/** Ücretsiz kaynaklı (admin / 0₺ / ödül) kaydı gün ekleyerek uzatır. */
export async function extendSubscriptionAction(subscriptionId: string, days: number): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  if (!UUID.test(subscriptionId)) return { ok: false, error: 'Kayıt bulunamadı.' }
  const n = Math.floor(Number(days))
  if (!(n >= 1 && n <= 366)) return { ok: false, error: 'Gün 1–366 olmalı.' }
  const row = await getSubscription(ctx.admin, subscriptionId)
  if (!row || isPaidSource(row.source)) return { ok: false, error: 'Ücretli abonelik uzatılamaz; yeni bir admin tanımı aç.' }
  if (!row.current_period_end) return { ok: false, error: 'Süresiz kayıt.' }
  const base = Math.max(Date.now(), new Date(row.current_period_end).getTime())
  await updateSubscription(ctx.admin, row.id, { status: 'active', current_period_end: new Date(base + n * DAY_MS).toISOString(), expiry_notice_for: null })
  await syncUserSpotlight(ctx.admin, row.user_id)
  return done(`${n} gün uzatıldı.`)
}

export async function endFreeSubscriptionAction(subscriptionId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  if (!UUID.test(subscriptionId)) return { ok: false, error: 'Kayıt bulunamadı.' }
  const row = await getSubscription(ctx.admin, subscriptionId)
  if (!row || isPaidSource(row.source)) return { ok: false, error: 'Ücretli abonelik buradan bitirilmez (kullanıcı iptali ya da iade).' }
  await updateSubscription(ctx.admin, row.id, { status: 'expired', current_period_end: new Date().toISOString() })
  await syncUserSpotlight(ctx.admin, row.user_id)
  return done('Kayıt sona erdirildi.')
}

export async function reconcileSubscriptionAction(subscriptionId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  if (!UUID.test(subscriptionId)) return { ok: false, error: 'Kayıt bulunamadı.' }
  const row = await getSubscription(ctx.admin, subscriptionId)
  if (!row) return { ok: false, error: 'Kayıt bulunamadı.' }
  if (row.source === 'iyzico') {
    const res = await reconcileIyzicoSubscription(ctx.admin, row)
    return res.ok ? done('iyzico ile eşitlendi.') : { ok: false, error: res.error ?? 'Eşitlenemedi.' }
  }
  if (row.source === 'apple' || row.source === 'google') {
    return (await refreshStoreSubscription(ctx.admin, row)) ? done('Mağaza ile eşitlendi.') : { ok: false, error: 'Mağazadan okunamadı (anahtarlar tanımlı mı?).' }
  }
  await syncUserSpotlight(ctx.admin, row.user_id)
  return done('Spotlight eşitlendi.')
}

export async function refundPaymentAction(paymentId: string, input: { mode: 'cancel' | 'refund'; amount: number | null; note: string }): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  const ip = (headers().get('x-forwarded-for') ?? '').split(',')[0]?.trim() || '127.0.0.1'
  const res = await refundIyzicoPaymentAsAdmin(ctx.admin, ctx.adminUserId, String(paymentId), {
    mode: input?.mode === 'cancel' ? 'cancel' : 'refund',
    amount: input?.amount ?? null,
    note: String(input?.note ?? ''),
    ip,
  })
  if (!res.ok) return res
  return done('İade kaydedildi. Aboneliği de bitirmek gerekiyorsa kullanıcı iptal etmeli ya da kaydı eşitle.')
}

/** Ücretli iyzico aboneliğini kullanıcı adına iptal eder (yeni tahsilat durur, Spotlight dönem sonuna kadar). */
export async function cancelPaidSubscriptionAction(subscriptionId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  if (!UUID.test(subscriptionId)) return { ok: false, error: 'Kayıt bulunamadı.' }
  const row = await getSubscription(ctx.admin, subscriptionId)
  if (!row || row.source !== 'iyzico') return { ok: false, error: 'Yalnızca web (iyzico) aboneliği buradan iptal edilir; mağaza aboneliği mağazadan.' }
  const res = await cancelIyzicoForUser(ctx.admin, row.user_id, row.id)
  return res.ok ? done('Abonelik iptal edildi (dönem sonuna kadar açık).') : { ok: false, error: res.error }
}

/** Kullanıcının bütün ücretsiz kayıtlarını bitirir (admin panelindeki "Spotlight kapat" ile aynı). */
export async function endAllFreeForUserAction(userId: string): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx) return { ok: false, error: 'Bu işlem için yetkiniz yok.' }
  if (!UUID.test(userId)) return { ok: false, error: 'Kullanıcı bulunamadı.' }
  const res = await endFreeSubscriptions(ctx.admin, userId)
  return res.ok ? done(`${res.ended} kayıt bitirildi.`) : { ok: false, error: 'Bitirilemedi.' }
}
