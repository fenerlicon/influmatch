// Spotlight üyeliğinin süresi dolunca (veya hesap onayı düşünce) kapatılması.
//
// spotlight_active istemci tarafından yazılamaz (users_before_update_guard beyaz listesi), bu yüzden
// kapatma her zaman service role ile yapılır. Saatlik görev tüm kullanıcılar için, Spotlight sayfası
// ise sadece oturumdaki kullanıcı için çağırır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SpotlightExpiryResult {
  expired: string[] // süresi dolduğu için kapatılanlar
  unverified: string[] // onayı düştüğü için kapatılanlar
}

/** Süresi dolmuş veya hesabı onaylı olmayan aktif Spotlight üyeliklerini kapatır. */
export async function expireSpotlights(admin: SupabaseClient, options: { userId?: string; now?: Date } = {}): Promise<SpotlightExpiryResult> {
  const nowIso = (options.now ?? new Date()).toISOString()

  let expiredQuery = admin.from('users').update({ spotlight_active: false }).eq('spotlight_active', true).lt('spotlight_expires_at', nowIso)
  if (options.userId) expiredQuery = expiredQuery.eq('id', options.userId)
  const { data: expired, error: expiredError } = await expiredQuery.select('id')
  if (expiredError) throw new Error(`Spotlight süresi dolanlar kapatılamadı: ${expiredError.message}`)

  let unverifiedQuery = admin.from('users').update({ spotlight_active: false }).eq('spotlight_active', true).neq('verification_status', 'verified')
  if (options.userId) unverifiedQuery = unverifiedQuery.eq('id', options.userId)
  const { data: unverified, error: unverifiedError } = await unverifiedQuery.select('id')
  if (unverifiedError) throw new Error(`Onaysız Spotlight üyelikleri kapatılamadı: ${unverifiedError.message}`)

  return {
    expired: (expired ?? []).map((row) => row.id as string),
    unverified: (unverified ?? []).map((row) => row.id as string),
  }
}
