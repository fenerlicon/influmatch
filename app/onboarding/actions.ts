'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { saveOnboarding, type OnboardingPayload, type OnboardingResult } from '@/lib/onboarding'

interface SaveOnboardingPayload extends OnboardingPayload {
  userId: string
}

// Doğrulama ve kayıt lib/onboarding.ts'de; mobil /api/mobile/onboarding aynı kodu kullanır.
export async function saveOnboardingProfile(payload: SaveOnboardingPayload): Promise<OnboardingResult> {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== payload.userId) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  const { userId: _userId, ...rest } = payload
  const result = await saveOnboarding(supabase, { id: user.id, email: user.email }, rest)

  if (result.success) {
    revalidatePath('/dashboard')
    revalidatePath('/onboarding')
  }
  return result
}
