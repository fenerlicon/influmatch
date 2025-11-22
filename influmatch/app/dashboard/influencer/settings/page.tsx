export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { Settings } from 'lucide-react'
import SettingsTabs from '@/components/settings/SettingsTabs'

export default async function InfluencerSettingsPage() {
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

  // Fetch user's support tickets
  const { data: supportTickets } = await supabase
    .from('support_tickets')
    .select('id, subject, priority, status, message, admin_response, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#131421] to-[#090a0f] p-6 text-white shadow-glow">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-soft-gold/30 bg-soft-gold/10 p-3">
            <Settings className="h-6 w-6 text-soft-gold" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold">Ayarlar</h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-gray-300">
          Bildirim tercihlerini ve hesap ayarlarını buradan yönetebilirsin.
        </p>
      </header>

      {/* Settings Tabs */}
      <SettingsTabs
        userId={user.id}
        emailSettings={emailSettings}
        supportTickets={(supportTickets ?? []) as any}
      />
    </div>
  )
}

