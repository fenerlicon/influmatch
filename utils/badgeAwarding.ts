// Sunucu içi yardımcı: 'use server' DEĞİLDİR. Aksi halde awardBadgesForUser(herhangiBirId)
// istemciden doğrudan çağrılabilen bir sunucu aksiyonu olurdu. Çağıranlar yetkiyi kendisi kontrol eder.

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { calculateProfileCompletion } from '@/utils/profileCompletion'
import type { ProfileRecord } from '@/utils/profileCompletion'
import { awardFounderBadgeIfEligible } from '@/lib/founder-badge'

/**
 * Award badges automatically based on user achievements
 */
export async function awardBadgesForUser(userId: string) {
  const supabase = createSupabaseServerClient()
  // Okumalar service role ile (başka kullanıcıların satırları RLS'e takılmasın).
  const adminClient = createSupabaseAdminClient()
  const reader = adminClient ?? supabase

  // Get user profile
  const { data: user, error: userError } = await reader
    .from('users')
    .select('id, role, verification_status, created_at, full_name, username, city, bio, category, avatar_url, social_links')
    .eq('id', userId)
    .maybeSingle()

  if (userError || !user) {
    console.error('[awardBadgesForUser] User fetch error:', userError)
    return { awarded: 0, badgeIds: [], error: userError?.message || 'User not found' }
  }

  const role = user.role as 'influencer' | 'brand'
  const badgesToAward: string[] = []

  // Check existing badges
  const { data: existingBadges } = await reader
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)

  const existingBadgeIds = existingBadges?.map((b) => b.badge_id) ?? []

  if (role === 'influencer') {
    // 1. Mavi tik (verified-account) burada verilmez: lib/blue-tick.ts (syncBlueTick) kuralı uygular
    //    (Spotlight + doğrulanmış hesap + taze istatistik + takipçi + güven skoru); admin istisnası
    //    users.blue_tick_override ile.
    // No automatic logic here.

    // 2. Profile Expert Badge (100% completion)
    const profileData: ProfileRecord = {
      full_name: user.full_name ?? null,
      username: user.username ?? null,
      city: user.city ?? null,
      bio: user.bio ?? null,
      category: user.category ?? null,
      avatar_url: user.avatar_url ?? null,
      social_links: (user.social_links as Record<string, string | null> | null) ?? null,
    }
    const completion = calculateProfileCompletion(profileData)
    if (completion.percent >= 100 && !existingBadgeIds.includes('profile-expert')) {
      badgesToAward.push('profile-expert')
    }

    // 3. Kurucu Üye rozeti artık rol bağımsız ve doğrulamaya bağlı (2026-10-26 kararı): aşağıda awardFounderBadgeIfEligible.
  } else if (role === 'brand') {
    // 1. Official Business Badge (sarı tik) burada verilmez: vergi onayı + doğrulanmış kurumsal
    // e-posta kuralı lib/official-business.ts içindeki syncOfficialBusiness ile uygulanır.

    // 2. Showcase Brand Badge (Complete profile)
    const profileData: ProfileRecord = {
      full_name: user.full_name ?? null,
      username: user.username ?? null,
      city: user.city ?? null,
      bio: user.bio ?? null,
      category: user.category ?? null,
      avatar_url: user.avatar_url ?? null,
      social_links: (user.social_links as Record<string, string | null> | null) ?? null,
    }
    const completion = calculateProfileCompletion(profileData)
    if (completion.percent >= 100 && !existingBadgeIds.includes('showcase-brand')) {
      badgesToAward.push('showcase-brand')
    }

    // 3. Pioneer Brand Badge (Every approved brand)
    if (user.verification_status === 'verified' && !existingBadgeIds.includes('pioneer-brand')) {
      badgesToAward.push('pioneer-brand')
    }
  }

  // Award badges
  if (badgesToAward.length > 0) {
    // Try admin client first (if available), otherwise use SQL function
    if (adminClient) {
      try {
        const badgeInserts = badgesToAward.map((badgeId) => ({
          user_id: userId,
          badge_id: badgeId,
        }))

        // Use upsert to avoid duplicate errors
        const { error: adminInsertError } = await adminClient
          .from('user_badges')
          .upsert(badgeInserts, { onConflict: 'user_id,badge_id' })

        if (adminInsertError) {
          console.error('[awardBadgesForUser] Admin client insert error:', adminInsertError)
          throw adminInsertError
        }
      } catch (adminError: any) {
        console.error('[awardBadgesForUser] Admin client failed, falling back to SQL function:', adminError)
        // Fall through to SQL function
        await awardBadgesUsingSQLFunction(supabase, userId, badgesToAward)
      }
    } else {
      // No admin client available, use SQL function directly
      await awardBadgesUsingSQLFunction(supabase, userId, badgesToAward)
    }
  }

  // Kurucu Üye (influencer, UGC, marka): hesap doğrulanmışsa ve 0₺ kampanyası son tarihi geçmediyse; bir kez bildirim gider.
  // Service role gerekir; yoksa saatlik görev verir.
  const founderAwarded = adminClient ? await awardFounderBadgeIfEligible(adminClient, userId) : false
  if (founderAwarded) badgesToAward.push('founder-member')

  return { awarded: badgesToAward.length, badgeIds: badgesToAward }
}

/**
 * Helper function to award badges using SQL function
 */
async function awardBadgesUsingSQLFunction(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  badgesToAward: string[]
) {
  let successCount = 0
  const errors: Array<{ badgeId: string; error: any }> = []

  for (const badgeId of badgesToAward) {
    // First try SQL function
    const { error: functionError } = await supabase.rpc('award_user_badge', {
      target_user_id: userId,
      badge_id_to_award: badgeId,
    })

    if (functionError) {
      console.error(`[awardBadgesForUser] SQL function error for ${badgeId}:`, {
        message: functionError.message,
        code: functionError.code,
        details: functionError.details,
        hint: functionError.hint,
      })

      // SQL function failed - this should not happen if migration is applied correctly
      errors.push({ badgeId, error: functionError })
    } else {
      successCount++
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.badgeId}: ${e.error.message || e.error.code || 'Unknown error'}`).join('; ')
    console.error(`[awardBadgesForUser] ❌ Failed to award ${errors.length} out of ${badgesToAward.length} badge(s): ${errorMessages}`)
    throw new Error(`Failed to award ${errors.length} badge(s): ${errors.map(e => e.badgeId).join(', ')}. Hata: ${errorMessages}. Lütfen SQL migration'ı çalıştırdığınızdan emin olun.`)
  } else {
  }
}

