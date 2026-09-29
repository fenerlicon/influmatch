'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  issueVerificationCode,
  refreshInstagramAccount,
  refreshTikTokAccount,
  type SocialResult,
} from '@/lib/social-stats'

// Bu dosyadaki fonksiyonlar istemciden çağrılabilen server action'lardır.
// Her biri önce oturumdaki kullanıcının, işlem yaptığı userId ile aynı kişi olduğunu doğrular;
// asıl iş @/lib/social-stats içinde yapılır.

async function isCurrentUser(userId: string) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user && user.id === userId
}

async function run(userId: string, task: () => Promise<SocialResult>): Promise<SocialResult> {
  if (!(await isCurrentUser(userId))) {
    return { success: false, error: 'Yetkisiz işlem.' }
  }

  try {
    return await task()
  } catch (error) {
    console.error('[social-verification] Unexpected error:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' }
  }
}

function revalidateSocialPaths() {
  revalidatePath('/dashboard/influencer')
  revalidatePath('/dashboard/influencer/profile')
  revalidatePath('/')
}

export async function generateVerificationCode(userId: string, username: string) {
  const result = await run(userId, () => issueVerificationCode(userId, 'instagram', username))
  if (result.success) revalidateSocialPaths()
  return result
}

export async function verifyInstagramAccount(userId: string) {
  const result = await run(userId, () => refreshInstagramAccount(userId))
  if (result.success) revalidateSocialPaths()
  return result
}

export async function generateTikTokVerificationCode(userId: string, username: string) {
  const result = await run(userId, () => issueVerificationCode(userId, 'tiktok', username))
  if (result.success) revalidateSocialPaths()
  return result
}

export async function verifyTikTokAccount(userId: string) {
  const result = await run(userId, () => refreshTikTokAccount(userId))
  if (result.success) revalidateSocialPaths()
  return result
}
