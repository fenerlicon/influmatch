export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import SettingsTabs from '@/components/settings/SettingsTabs'
import BrandPortfolioSetting from '@/components/settings/BrandPortfolioSetting'
import { getBrandPortfolioSettingAs } from '@/lib/portfolio-results'

export default async function BrandSettingsPage({ searchParams }: { searchParams: { bolum?: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's email notification settings
  const { data: profile } = await supabase
    .from('users')
    .select('email_notifications')
    .eq('id', user.id)
    .maybeSingle()

  const defaultSettings = {
    offers: true,
    advert_applications: true,
    messages: true,
    marketing: false,
    updates: true,
  }

  const emailSettings = (profile?.email_notifications as typeof defaultSettings | null) ?? defaultSettings

  // Portföylerde marka adı tercihi (4.3-S7; varsayılan kapalı).
  const portfolioSetting = await getBrandPortfolioSettingAs(supabase, user.id)

  // Fetch user's support tickets
  const { data: supportTickets } = await supabase
    .from('support_tickets')
    .select('id, subject, priority, status, message, admin_response, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <SettingsTabs
      basePath="/dashboard/brand/settings"
      section={searchParams.bolum}
      userId={user.id}
      emailSettings={emailSettings}
      supportTickets={(supportTickets ?? []) as any}
      preferences={'showBrandName' in portfolioSetting ? <BrandPortfolioSetting initial={portfolioSetting.showBrandName} /> : undefined}
    />
  )
}
