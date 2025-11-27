'use client'

import { useState } from 'react'
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
  userId: string
  emailSettings: {
    offers: boolean
    advert_applications: boolean
    messages: boolean
    marketing: boolean
    updates: boolean
  }
  supportTickets?: SupportTicket[]
}

const tabs = [
  { key: 'notifications', label: 'Bildirimler', icon: '🔔' },
  { key: 'account', label: 'Hesap', icon: '⚙️' },
  { key: 'support', label: 'Yardım ve Destek', icon: '💬' },
] as const

export default function SettingsTabs({ userId, emailSettings, supportTickets = [] }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['key']>('notifications')

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'notifications' && (
          <EmailNotificationSettings userId={userId} initialSettings={emailSettings} />
        )}
        {activeTab === 'account' && <AccountSettings />}
        {activeTab === 'support' && <SupportSection userId={userId} initialTickets={supportTickets} />}
      </div>
    </div>
  )
}

