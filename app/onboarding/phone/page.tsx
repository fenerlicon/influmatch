import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import PhoneForm from '@/components/onboarding/PhoneForm'
import { needsPhone } from '@/lib/user-contact'

export const dynamic = 'force-dynamic'

/**
 * Zorunlu telefon (2026-11-24): numarası olmayan mevcut influencer / UGC / marka hesapları panele girmeden önce bir kez buraya gelir
 * (app/dashboard/layout.tsx). Yeni kayıtlarda numara onboarding formunda alınır.
 */
export default async function OnboardingPhonePage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role, username, full_name').eq('id', user.id).maybeSingle()
  if (!profile?.username || !profile.full_name) redirect('/onboarding')
  if (!(await needsPhone(user.id, profile.role as string | null))) redirect('/dashboard')

  return (
    <OnboardingShell eyebrow="Son bir adım" title="Telefon numaranı ekle" description="Hesabını kullanmaya devam etmek için telefon numaranı eklemen gerekiyor.">
      <PhoneForm />
    </OnboardingShell>
  )
}
