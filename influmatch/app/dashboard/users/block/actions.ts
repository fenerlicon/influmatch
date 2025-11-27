'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function blockUser(blockedUserId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  if (user.id === blockedUserId) {
    return { success: false, error: 'Cannot block yourself' }
  }

  // Check if user exists
  const { data: blockedUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', blockedUserId)
    .maybeSingle()

  if (userError || !blockedUser) {
    return { success: false, error: 'User not found' }
  }

  // Insert block (upsert to handle duplicates)
  const { error: blockError } = await supabase.from('user_blocks').upsert(
    {
      blocker_user_id: user.id,
      blocked_user_id: blockedUserId,
    },
    { onConflict: 'blocker_user_id,blocked_user_id' },
  )

  if (blockError) {
    console.error('Block user error:', blockError)
    return { success: false, error: 'Failed to block user' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function unblockUser(blockedUserId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error: unblockError } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_user_id', user.id)
    .eq('blocked_user_id', blockedUserId)

  if (unblockError) {
    console.error('Unblock user error:', unblockError)
    return { success: false, error: 'Failed to unblock user' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function isUserBlocked(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { blocked: false }
  }

  // Check if current user is blocked by the other user (can't send messages to them)
  const { data: blockCheck } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', userId)
    .eq('blocked_user_id', user.id)
    .maybeSingle()

  const isBlockedByOther = !!blockCheck

  // Also check if current user has blocked the other user
  const { data: hasBlocked } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_user_id', user.id)
    .eq('blocked_user_id', userId)
    .maybeSingle()

  return { 
    blocked: isBlockedByOther,
    hasBlocked: !!hasBlocked
  }
}

