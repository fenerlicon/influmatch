'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { calculateProfileCompletion } from '@/utils/profileCompletion'
import type { ProfileRecord } from '@/utils/profileCompletion'

/**
 * Award badges automatically based on user achievements
 */
export async function awardBadgesForUser(userId: string) {
  const supabase = createSupabaseServerClient()

  // Get user profile
  const { data: user, error: userError } = await supabase
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
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)

  const existingBadgeIds = existingBadges?.map((b) => b.badge_id) ?? []

  if (role === 'influencer') {
    // 1. Verified Account Badge
    // Requirement: Must be Admin Verified AND have Data Verified badge
    const hasDataVerifiedBadge = existingBadgeIds.includes('data-verified')

    if (user.verification_status === 'verified' && hasDataVerifiedBadge && !existingBadgeIds.includes('verified-account')) {
      badgesToAward.push('verified-account')
    }

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

    // 3. Founder Member Badge (First 1000 influencers by created_at)
    const { count: earlierUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'influencer')
      .lt('created_at', user.created_at || new Date().toISOString())

    if (earlierUsers !== null && earlierUsers < 1000 && !existingBadgeIds.includes('founder-member')) {
      badgesToAward.push('founder-member')
    }
  } else if (role === 'brand') {
    // 1. Official Business Badge
    if (user.verification_status === 'verified' && !existingBadgeIds.includes('official-business')) {
      badgesToAward.push('official-business')
    }

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

    // 3. Pioneer Brand Badge (First 100 brands by created_at)
    const { count: earlierBrands } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'brand')
      .lt('created_at', user.created_at || new Date().toISOString())

    if (earlierBrands !== null && earlierBrands < 100 && !existingBadgeIds.includes('pioneer-brand')) {
      badgesToAward.push('pioneer-brand')
    }
  }

  // Award badges
  if (badgesToAward.length > 0) {
    console.log(`[awardBadgesForUser] Attempting to award ${badgesToAward.length} badge(s) to user ${userId}:`, badgesToAward)

    // Try admin client first (if available), otherwise use SQL function
    const adminClient = createSupabaseAdminClient()

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
        } else {
          console.log(`[awardBadgesForUser] ✅ Successfully awarded ${badgesToAward.length} badge(s) using admin client:`, badgesToAward)
        }
      } catch (adminError: any) {
        console.error('[awardBadgesForUser] Admin client failed, falling back to SQL function:', adminError)
        // Fall through to SQL function
        await awardBadgesUsingSQLFunction(supabase, userId, badgesToAward)
      }
    } else {
      // No admin client available, use SQL function directly
      console.log('[awardBadgesForUser] Admin client not available, using SQL function...')
      await awardBadgesUsingSQLFunction(supabase, userId, badgesToAward)
    }
  } else {
    console.log(`[awardBadgesForUser] No badges to award for user ${userId}`)
    console.log('[awardBadgesForUser] User role:', role)
    console.log('[awardBadgesForUser] User verification_status:', user.verification_status)
    console.log('[awardBadgesForUser] Existing badges:', existingBadgeIds)

    // Debug profile completion for influencer
    if (role === 'influencer') {
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
      console.log('[awardBadgesForUser] Profile completion:', completion.percent, '%')
      console.log('[awardBadgesForUser] Profile checklist:', completion.checklist)
    }
  }

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
    const { error: functionError, data: functionData } = await supabase.rpc('award_user_badge', {
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
      console.log(`[awardBadgesForUser] ✅ Successfully awarded ${badgeId} using SQL function`)
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.badgeId}: ${e.error.message || e.error.code || 'Unknown error'}`).join('; ')
    console.error(`[awardBadgesForUser] ❌ Failed to award ${errors.length} out of ${badgesToAward.length} badge(s): ${errorMessages}`)
    throw new Error(`Failed to award ${errors.length} badge(s): ${errors.map(e => e.badgeId).join(', ')}. Hata: ${errorMessages}. Lütfen SQL migration'ı çalıştırdığınızdan emin olun.`)
  } else {
    console.log(`[awardBadgesForUser] ✅ Successfully awarded all ${badgesToAward.length} badge(s)`)
  }
}

