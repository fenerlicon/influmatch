import type { ReactNode } from 'react'
import { Bell, LifeBuoy, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui'
import EmailNotificationSettings from './EmailNotificationSettings'
import AccountSettings from './AccountSettings'
import SupportSection from './SupportSection'

interface SupportTicket {
  id: string
  subject: string
  priority: 'Düşük' | 'Orta' | 'Acil'
  status: 'open' | 'in_progress' | 'closed'
  message: string
  admin_response: string | null
  created_at: string
  updated_at: string
}

interface SettingsTabsProps {
  /** Sayfanın adresi (ör. /dashboard/influencer/settings); bölümler ?bolum= ile açılır. */
  basePath: string
  /** ?bolum= değeri. */
  section?: string
  userId: string
  emailSettings: {
    offers: boolean
    advert_applications: boolean
    messages: boolean
    marketing: boolean
    updates: boolean
  }
  supportTickets?: SupportTicket[]
  /** Role özel tercihler (müsaitlik, portföy). Yoksa "Tercihler" bölümü gösterilmez. */
  preferences?: ReactNode
}

const SECTIONS = [
  { value: 'tercihler', label: 'Tercihler', icon: <SlidersHorizontal /> },
  { value: 'bildirimler', label: 'Bildirimler', icon: <Bell /> },
  { value: 'guvenlik', label: 'Güvenlik', icon: <ShieldCheck /> },
  { value: 'destek', label: 'Yardım ve destek', icon: <LifeBuoy /> },
] as const

export default function SettingsTabs({ basePath, section, userId, emailSettings, supportTickets = [], preferences }: SettingsTabsProps) {
  const sections = SECTIONS.filter((s) => s.value !== 'tercihler' || preferences)
  const active = sections.find((s) => s.value === section)?.value ?? sections[0].value

  return (
    <div className="grid gap-5">
      <PageHeader title="Ayarlar" description="Tercihlerini, bildirimlerini ve hesap güvenliğini buradan yönetirsin." />
      <Tabs
        label="Ayar bölümleri"
        value={active}
        items={sections.map((s) => ({ ...s, href: `${basePath}?bolum=${s.value}` }))}
      />
      <div className="grid gap-5">
        {active === 'tercihler' && preferences}
        {active === 'bildirimler' && <EmailNotificationSettings userId={userId} initialSettings={emailSettings} />}
        {active === 'guvenlik' && <AccountSettings />}
        {active === 'destek' && <SupportSection userId={userId} initialTickets={supportTickets} />}
      </div>
    </div>
  )
}
