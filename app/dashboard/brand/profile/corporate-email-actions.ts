'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import {
  saveCorporateEmail,
  sendCorporateEmailCode,
  verifyCorporateEmailCode,
  type CorporateEmailResult,
} from '@/lib/corporate-email-verification'

async function run(task: (admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) => Promise<CorporateEmailResult>) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Oturum açmanız gerekiyor.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false as const, error: 'Sistem yapılandırma hatası.' }

  try {
    const result = await task(admin, user.id)
    revalidatePath('/dashboard/brand/profile')
    return result
  } catch (error) {
    console.error('[corporate-email]', error)
    return { success: false as const, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

/** Kurumsal e-postayı kaydeder ve doğrulama kodu gönderir. */
export async function submitCorporateEmail(email: string): Promise<CorporateEmailResult> {
  return run(async (admin, userId) => {
    const saved = await saveCorporateEmail(admin, userId, email)
    if (!saved.success || saved.message.includes('zaten doğrulanmış')) return saved
    return sendCorporateEmailCode(admin, userId)
  })
}

export async function resendCorporateEmailCode(): Promise<CorporateEmailResult> {
  return run((admin, userId) => sendCorporateEmailCode(admin, userId))
}

export async function confirmCorporateEmailCode(code: string): Promise<CorporateEmailResult> {
  return run((admin, userId) => verifyCorporateEmailCode(admin, userId, code))
}
