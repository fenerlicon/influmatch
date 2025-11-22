'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function checkIfBlocked(otherUserId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { blocked: false, hasBlocked: false }
  }

  // Check if current user is blocked by the other user (can't send messages to them)
  const { data: blockCheck } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', otherUserId)
    .eq('blocked_user_id', user.id)
    .maybeSingle()

  const isBlockedByOther = !!blockCheck

  // Also check if current user has blocked the other user
  const { data: hasBlocked } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', user.id)
    .eq('blocked_user_id', otherUserId)
    .maybeSingle()

  return {
    blocked: isBlockedByOther,
    hasBlocked: !!hasBlocked,
  }
}

