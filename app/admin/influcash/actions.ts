'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import {
  addPartnerCoupons,
  adjustBalanceAsAdmin,
  lookupLedger,
  saveCatalogItem,
  saveInflucashSettings,
  type CatalogInput,
} from '@/lib/influcash'
import { validateInflucashRulesInput } from '@/lib/influcash-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true } & T) | { success: false; error: string }

// Influcash admin (2026-11-23). Rol DB'den kontrol edilir; tablolar yalnızca service role ile.
async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' as const }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.' as const }
  return { admin, userId: user.id }
}

export async function saveInflucashFlags(input: { enabled?: boolean; partnerCouponsEnabled?: boolean }): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const patch: { enabled?: boolean; partnerCouponsEnabled?: boolean } = {}
  if (typeof input?.enabled === 'boolean') patch.enabled = input.enabled
  if (typeof input?.partnerCouponsEnabled === 'boolean') patch.partnerCouponsEnabled = input.partnerCouponsEnabled
  try {
    await saveInflucashSettings(ctx.admin, ctx.userId, patch)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Kaydedilemedi.' }
  }
  revalidatePath('/admin/influcash')
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function saveInflucashRules(input: Record<string, unknown>): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const rules = validateInflucashRulesInput(input ?? {})
  if ('error' in rules) return { success: false, error: rules.error }
  try {
    await saveInflucashSettings(ctx.admin, ctx.userId, { rules })
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Kaydedilemedi.' }
  }
  revalidatePath('/admin/influcash')
  return { success: true }
}

export async function saveInflucashItem(input: CatalogInput): Promise<Result> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await saveCatalogItem(ctx.admin, input ?? {})
  if (!result.success) return { success: false, error: result.error }
  revalidatePath('/admin/influcash')
  return { success: true }
}

export async function addInflucashCoupons(itemId: string, codes: string): Promise<Result<{ added: number }>> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await addPartnerCoupons(ctx.admin, itemId, codes)
  if (!result.success) return { success: false, error: result.error }
  revalidatePath('/admin/influcash')
  return { success: true, added: result.added }
}

export async function lookupInflucashUser(query: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false as const, error: ctx.error as string }
  const result = await lookupLedger(ctx.admin, typeof query === 'string' ? query.slice(0, 200) : '')
  if (!result) return { success: false as const, error: 'Kullanıcı bulunamadı (kullanıcı adı, e-posta ya da kimlik).' }
  return { success: true as const, ...result }
}

export async function adjustInflucash(userId: string, amount: number, note: string): Promise<Result<{ balance: number }>> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { success: false, error: ctx.error as string }
  const result = await adjustBalanceAsAdmin(ctx.admin, ctx.userId, userId, amount, note)
  if (!result.success) return { success: false, error: result.error }
  revalidatePath('/admin/influcash')
  return { success: true, balance: result.balance }
}
