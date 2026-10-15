export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import SettingsTabs from '@/components/settings/SettingsTabs'
import AvailabilitySettings from '@/components/settings/AvailabilitySettings'
import { getOwnAvailability } from '@/lib/availability'
import { getOwnPortfolioAs } from '@/lib/portfolio-results'
import PortfolioResults from '@/components/profile/PortfolioResults'

export default async function InfluencerSettingsPage({ searchParams }: { searchParams: { bolum?: string } }) {
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

  // Müsaitlik (3.19): kendi satırı, kolon SELECT yetkisiyle.
  const availability = await getOwnAvailability(supabase, user.id)
  // Portföy sonuçları (4.3-S7): kendi sonuçları her zaman; profilde başkalarına yalnızca Influencer Pro'da görünür.
  const ownPortfolio = await getOwnPortfolioAs(supabase, user.id)

  // Fetch user's support tickets
  const { data: supportTickets } = await supabase
    .from('support_tickets')
    .select('id, subject, priority, status, message, admin_response, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <SettingsTabs
      basePath="/dashboard/influencer/settings"
      section={searchParams.bolum}
      userId={user.id}
      emailSettings={emailSettings}
      supportTickets={(supportTickets ?? []) as any}
      preferences={
        <>
          <AvailabilitySettings initial={availability} />
          {'portfolio' in ownPortfolio && <PortfolioResults view={ownPortfolio.portfolio} />}
        </>
      }
    />
  )
}
