'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { awardDailyLogin, redeemItem } from '@/lib/influcash'

// Influcash (2026-11-23) web aksiyonları. Kurallar ve yetki lib/influcash.ts'te (bayrak, rol, bakiye, saatlik sınır).

async function currentUserId() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function redeemInflucashAction(itemId: string): Promise<{ success: true; error?: undefined; message: string; code: string | null } | { success?: undefined; error: string }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Oturumunuz bulunamadı.' }
  const result = await redeemItem(userId, itemId)
  if (!result.success) return { error: result.error }
  revalidatePath('/dashboard/influcash')
  revalidatePath('/dashboard', 'layout')
  return { success: true, message: result.message, code: result.code }
}

/** Günlük giriş ödülü (panel açılışında günde bir kez çağrılır; tekrar çağrı zararsız). */
export async function dailyInflucashAction(): Promise<{ awarded: number }> {
  const userId = await currentUserId()
  if (!userId) return { awarded: 0 }
  const result = await awardDailyLogin(userId)
  return { awarded: result.awarded }
}
