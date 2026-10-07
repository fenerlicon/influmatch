// Kurala bağlı rozetlerin ortak eşitleyicisi: kuralı sağlayanlara rozet verilir, sağlamayanlardan geri
// alınır ve vitrinden (displayed_badges) düşürülür. Saatlik görev kullanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface BadgeSyncSummary {
  eligible: number
  granted: number
  revoked: number
  errors: number
}

/**
 * @param eligibleIds kuralı sağlayan kullanıcılar
 * @param role rozetin ait olduğu rol; başka roldeki adaylar elenir
 */
export async function syncBadgeHolders(
  admin: SupabaseClient,
  badgeId: string,
  eligibleIds: Set<string>,
  role: 'influencer' | 'brand',
): Promise<BadgeSyncSummary> {
  const { data: holderRows, error: holderError } = await admin.from('user_badges').select('user_id').eq('badge_id', badgeId)
  if (holderError) throw new Error(`${badgeId} sahipleri okunamadı: ${holderError.message}`)
  const holders = new Set((holderRows ?? []).map((row) => row.user_id as string))

  let eligible = new Set<string>()
  const candidates = Array.from(eligibleIds)
  for (let i = 0; i < candidates.length; i += 200) {
    const { data, error } = await admin.from('users').select('id').eq('role', role).in('id', candidates.slice(i, i + 200))
    if (error) throw new Error(`${badgeId} adayları okunamadı: ${error.message}`)
    data?.forEach((row) => eligible.add(row.id as string))
  }

  const toGrant = Array.from(eligible).filter((id) => !holders.has(id))
  const toRevoke = Array.from(holders).filter((id) => !eligible.has(id))
  const summary: BadgeSyncSummary = { eligible: eligible.size, granted: 0, revoked: 0, errors: 0 }

  if (toGrant.length > 0) {
    const now = new Date().toISOString()
    const { error } = await admin
      .from('user_badges')
      .upsert(toGrant.map((user_id) => ({ user_id, badge_id: badgeId, earned_at: now })), { onConflict: 'user_id,badge_id' })
    if (error) {
      summary.errors += toGrant.length
      console.error(`[badge-sync] ${badgeId} verilemedi:`, error.message)
    } else {
      summary.granted = toGrant.length
    }
  }

  for (const userId of toRevoke) {
    try {
      // Önce vitrinden düşür (kazanılmamış rozetin gösterilmesini DB engeller), sonra rozeti sil.
      const { data: profile } = await admin.from('users').select('displayed_badges').eq('id', userId).maybeSingle()
      const displayed: string[] = Array.isArray(profile?.displayed_badges) ? profile!.displayed_badges : []
      if (displayed.includes(badgeId)) {
        await admin.from('users').update({ displayed_badges: displayed.filter((id) => id !== badgeId) }).eq('id', userId)
      }
      const { error } = await admin.from('user_badges').delete().eq('user_id', userId).eq('badge_id', badgeId)
      if (error) throw error
      summary.revoked++
    } catch (error) {
      summary.errors++
      console.error(`[badge-sync] ${userId} için ${badgeId} geri alınamadı:`, error)
    }
  }

  return summary
}
