// Mavi tik rozetini kurala (lib/blue-tick-rules.ts) ve admin istisnasına göre verir / geri alır.
//
// users.blue_tick_override: 'granted' -> kurala bakmadan ver, 'revoked' -> asla verme, null -> kural.
// Rozet hem user_badges tablosuna hem de kartlarda/mesajlarda okunan displayed_badges alanına yazılır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import {
  BLUE_TICK_BADGE_ID,
  evaluateBlueTick,
  type BlueTickAccount,
  type BlueTickProfile,
} from '@/lib/blue-tick-rules'

export type BlueTickOverride = 'granted' | 'revoked' | null

interface ProfileRow extends BlueTickProfile {
  role: string | null
  displayed_badges: string[] | null
  blue_tick_override: BlueTickOverride
}

const PROFILE_COLUMNS =
  'id, role, full_name, username, avatar_url, category, spotlight_active, spotlight_expires_at, displayed_badges, blue_tick_override'
const ACCOUNT_COLUMNS = 'user_id, platform, is_verified, has_stats, follower_count, engagement_rate, stats_payload, last_scraped_at'
const MAX_DISPLAYED_BADGES = 3
const CHUNK_SIZE = 200

export function shouldHaveBlueTick(profile: ProfileRow, accounts: BlueTickAccount[]) {
  if (profile.role !== 'influencer') return false
  if (profile.blue_tick_override === 'granted') return true
  if (profile.blue_tick_override === 'revoked') return false
  return evaluateBlueTick(profile, accounts).eligible
}

/** Rozeti ve vitrin alanını beklenen duruma getirir. Rozet durumu değiştiyse 'granted' / 'revoked' döner. */
async function applyBlueTick(
  admin: SupabaseClient,
  profile: ProfileRow,
  accounts: BlueTickAccount[],
  hasBadge: boolean,
): Promise<'granted' | 'revoked' | null> {
  const shouldHave = shouldHaveBlueTick(profile, accounts)
  const displayed = profile.displayed_badges ?? []
  const isDisplayed = displayed.includes(BLUE_TICK_BADGE_ID)

  if (shouldHave && !hasBadge) {
    const { error } = await admin
      .from('user_badges')
      .upsert({ user_id: profile.id, badge_id: BLUE_TICK_BADGE_ID, earned_at: new Date().toISOString() }, { onConflict: 'user_id,badge_id' })
    if (error) throw new Error(`Mavi tik verilemedi: ${error.message}`)
  }
  if (!shouldHave && hasBadge) {
    const { error } = await admin.from('user_badges').delete().eq('user_id', profile.id).eq('badge_id', BLUE_TICK_BADGE_ID)
    if (error) throw new Error(`Mavi tik kaldırılamadı: ${error.message}`)
  }

  if (shouldHave !== isDisplayed) {
    // Vitrin en fazla 3 rozet alır; mavi tik her zaman ilk sırada gösterilir.
    const nextDisplayed = shouldHave
      ? [BLUE_TICK_BADGE_ID, ...displayed].slice(0, MAX_DISPLAYED_BADGES)
      : displayed.filter((badgeId) => badgeId !== BLUE_TICK_BADGE_ID)
    const { error } = await admin.from('users').update({ displayed_badges: nextDisplayed }).eq('id', profile.id)
    if (error) console.error('[blue-tick] displayed_badges güncellenemedi:', error.message)
  }

  if (shouldHave === hasBadge) return null
  return shouldHave ? 'granted' : 'revoked'
}

/** Tek kullanıcının mavi tikini günceller (istatistik yenileme, Spotlight değişikliği, admin işlemi sonrası). */
export async function syncBlueTick(userId: string, admin: SupabaseClient | null = createSupabaseAdminClient()) {
  if (!admin) return null
  try {
    const [{ data: profile, error: profileError }, { data: accounts }, { data: badge }] = await Promise.all([
      admin.from('users').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
      admin.from('social_accounts').select(ACCOUNT_COLUMNS).eq('user_id', userId).in('platform', ['instagram', 'tiktok']),
      admin.from('user_badges').select('id').eq('user_id', userId).eq('badge_id', BLUE_TICK_BADGE_ID).maybeSingle(),
    ])
    if (profileError || !profile) return null
    return await applyBlueTick(admin, profile as ProfileRow, (accounts ?? []) as BlueTickAccount[], !!badge)
  } catch (error) {
    console.error(`[blue-tick] ${userId} güncellenemedi:`, error)
    return null
  }
}

/**
 * Mavi tiki olan veya alabilecek tüm influencerları yeniden değerlendirir (saatlik görev).
 * Spotlight süresi dolanların ve eşiğin altına düşenlerin tiki burada geri alınır.
 */
export async function sweepBlueTicks(admin: SupabaseClient) {
  const [candidates, badgeHolders, displayedHolders] = await Promise.all([
    admin.from('users').select('id').eq('role', 'influencer').or('spotlight_active.eq.true,blue_tick_override.not.is.null'),
    admin.from('user_badges').select('user_id').eq('badge_id', BLUE_TICK_BADGE_ID),
    admin.from('users').select('id').contains('displayed_badges', [BLUE_TICK_BADGE_ID]),
  ])
  const firstError = candidates.error ?? badgeHolders.error ?? displayedHolders.error
  if (firstError) throw new Error(`Mavi tik adayları okunamadı: ${firstError.message}`)

  const holderIds = new Set((badgeHolders.data ?? []).map((row) => row.user_id as string))
  const ids = Array.from(
    new Set([
      ...(candidates.data ?? []).map((row) => row.id as string),
      ...Array.from(holderIds),
      ...(displayedHolders.data ?? []).map((row) => row.id as string),
    ]),
  )

  const summary = { checked: 0, granted: 0, revoked: 0, errors: 0 }
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)
    const [{ data: profiles, error: profileError }, { data: accounts, error: accountError }] = await Promise.all([
      admin.from('users').select(PROFILE_COLUMNS).in('id', chunk),
      admin.from('social_accounts').select(ACCOUNT_COLUMNS).in('user_id', chunk).in('platform', ['instagram', 'tiktok']),
    ])
    if (profileError || accountError) throw new Error(`Mavi tik verileri okunamadı: ${(profileError ?? accountError)!.message}`)

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      summary.checked++
      try {
        const userAccounts = ((accounts ?? []) as (BlueTickAccount & { user_id: string })[]).filter((a) => a.user_id === profile.id)
        const change = await applyBlueTick(admin, profile, userAccounts, holderIds.has(profile.id))
        if (change === 'granted') summary.granted++
        if (change === 'revoked') summary.revoked++
      } catch (error) {
        summary.errors++
        console.error(`[blue-tick] ${profile.id} değerlendirilemedi:`, error)
      }
    }
  }
  return summary
}
