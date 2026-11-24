'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { saveOnboarding, type OnboardingPayload, type OnboardingResult } from '@/lib/onboarding'
import { needsSignupConsent } from '@/lib/oauth-signup'
import { getOwnContact, saveOwnContact } from '@/lib/user-contact'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

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
  const result = await saveOnboarding(supabase, { id: user.id, email: user.email }, { ...rest, signupSource: 'web' })

  if (result.success) {
    revalidatePath('/dashboard')
    revalidatePath('/onboarding')
  }
  return result
}

/** Google ile gelen yeni hesapta onboarding'de Kullanım Koşulları onayı ve davet kodu sorulmalı mı (lib/oauth-signup.ts). */
export async function getSignupRequirements(): Promise<{ needsConsent: boolean }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const admin = createSupabaseAdminClient()
  if (!user || !admin) return { needsConsent: false }
  return { needsConsent: await needsSignupConsent(admin, user) }
}

/** Telefon numarası kaydı (panel kapısı /onboarding/phone ve Ayarlar). Yalnızca platform görür. */
export async function savePhoneAction(input: { phone: string; marketingSms?: boolean }): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }
  const result = await saveOwnContact(user.id, { phone: input?.phone, marketingSms: typeof input?.marketingSms === 'boolean' ? input.marketingSms : undefined }, 'web')
  if (!result.success) return result
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

/** Kullanıcının kendi numarası (Ayarlar'da gösterim). */
export async function getOwnPhoneAction(): Promise<{ phone: string | null; marketingSms: boolean }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { phone: null, marketingSms: false }
  const contact = await getOwnContact(user.id)
  return { phone: contact?.phone ?? null, marketingSms: !!contact?.marketingSms }
}
