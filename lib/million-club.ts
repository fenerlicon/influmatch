// Milyon Kulübü rozeti: doğrulanmış bir Instagram/TikTok hesabında 1 milyon ve üzeri takipçi.
// Saatlik görevde toplu değerlendirilir; eşiğin altına düşen veya hesabı doğrulamadan çıkanın rozeti
// geri alınır ve vitrinden (displayed_badges) düşürülür.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'

export const MILLION_CLUB_BADGE_ID = 'million-club'
export const MILLION_CLUB_MIN_FOLLOWERS = 1_000_000

export async function sweepMillionClub(admin: SupabaseClient) {
  const [eligibleRes, holdersRes] = await Promise.all([
    admin
      .from('social_accounts')
      .select('user_id')
      .eq('is_verified', true)
      .in('platform', ['instagram', 'tiktok'])
      .gte('follower_count', MILLION_CLUB_MIN_FOLLOWERS),
    admin.from('user_badges').select('user_id').eq('badge_id', MILLION_CLUB_BADGE_ID),
  ])
  const firstError = eligibleRes.error ?? holdersRes.error
  if (firstError) throw new Error(`Milyon Kulübü verileri okunamadı: ${firstError.message}`)

  const eligible = new Set((eligibleRes.data ?? []).map((row) => row.user_id as string))
  const holders = new Set((holdersRes.data ?? []).map((row) => row.user_id as string))

  // Yalnızca influencer hesapları (marka hesabına sosyal hesap bağlanmış olabilir)
  let eligibleInfluencers = new Set<string>()
  if (eligible.size > 0) {
    const { data, error } = await admin.from('users').select('id').eq('role', 'influencer').in('id', Array.from(eligible))
    if (error) throw new Error(`Milyon Kulübü adayları okunamadı: ${error.message}`)
    eligibleInfluencers = new Set((data ?? []).map((row) => row.id as string))
  }

  const toGrant = Array.from(eligibleInfluencers).filter((id) => !holders.has(id))
  const toRevoke = Array.from(holders).filter((id) => !eligibleInfluencers.has(id))
  const summary = { eligible: eligibleInfluencers.size, granted: 0, revoked: 0, errors: 0 }

  if (toGrant.length > 0) {
    const now = new Date().toISOString()
    const { error } = await admin
      .from('user_badges')
      .upsert(toGrant.map((user_id) => ({ user_id, badge_id: MILLION_CLUB_BADGE_ID, earned_at: now })), { onConflict: 'user_id,badge_id' })
    if (error) {
      summary.errors += toGrant.length
      console.error('[million-club] rozet verilemedi:', error.message)
    } else {
      summary.granted = toGrant.length
    }
  }

  for (const userId of toRevoke) {
    try {
      // Önce vitrinden düşür (kazanılmamış rozetin gösterilmesini DB engeller), sonra rozeti sil.
      const { data: profile } = await admin.from('users').select('displayed_badges').eq('id', userId).maybeSingle()
      const displayed: string[] = Array.isArray(profile?.displayed_badges) ? profile!.displayed_badges : []
      if (displayed.includes(MILLION_CLUB_BADGE_ID)) {
        await admin
          .from('users')
          .update({ displayed_badges: displayed.filter((id) => id !== MILLION_CLUB_BADGE_ID) })
          .eq('id', userId)
      }
      const { error } = await admin.from('user_badges').delete().eq('user_id', userId).eq('badge_id', MILLION_CLUB_BADGE_ID)
      if (error) throw error
      summary.revoked++
    } catch (error) {
      summary.errors++
      console.error(`[million-club] ${userId} rozeti geri alınamadı:`, error)
    }
  }

  return summary
}
