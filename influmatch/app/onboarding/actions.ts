'use server'

import { awardBadgesForUser } from '@/utils/badgeAwarding'

/**
 * Award badges after onboarding completion
 */
export async function awardBadgesAfterOnboarding(userId: string) {
  await awardBadgesForUser(userId)
}

