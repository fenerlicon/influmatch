// Milyon Kulübü rozeti: doğrulanmış bir Instagram/TikTok hesabında 1 milyon ve üzeri takipçi.
// Saatlik görevde toplu değerlendirilir; eşiğin altına düşen veya hesabı doğrulamadan çıkanın rozeti
// geri alınır ve vitrinden düşürülür.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncBadgeHolders } from '@/lib/badge-sync'

export const MILLION_CLUB_BADGE_ID = 'million-club'
export const MILLION_CLUB_MIN_FOLLOWERS = 1_000_000

export async function sweepMillionClub(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('social_accounts')
    .select('user_id')
    .eq('is_verified', true)
    .in('platform', ['instagram', 'tiktok'])
    .gte('follower_count', MILLION_CLUB_MIN_FOLLOWERS)
  if (error) throw new Error(`Milyon Kulübü verileri okunamadı: ${error.message}`)

  const eligible = new Set((data ?? []).map((row) => row.user_id as string))
  return syncBadgeHolders(admin, MILLION_CLUB_BADGE_ID, eligible, 'influencer')
}
