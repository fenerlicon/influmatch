'use client'

import { useState, useTransition } from 'react'
import { updateEmailNotifications } from '@/app/dashboard/influencer/settings/actions'
import { Bell, Mail, ChevronDown, ChevronUp } from 'lucide-react'

interface EmailNotificationSettingsProps {
  userId: string
  initialSettings: {
    offers: boolean
    advert_applications: boolean
    messages: boolean
    marketing: boolean
    updates: boolean
  }
}

export default function EmailNotificationSettings({
  userId,
  initialSettings,
}: EmailNotificationSettingsProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] }
    setSettings(newSettings)

    startTransition(async () => {
      const result = await updateEmailNotifications(userId, newSettings)
      if (result.success) {
        setFeedback({ type: 'success', message: 'Ayarlar kaydedildi' })
        setTimeout(() => setFeedback(null), 2000)
      } else {
        setFeedback({ type: 'error', message: result.error || 'Bir hata oluştu' })
        // Revert on error
        setSettings(settings)
        setTimeout(() => setFeedback(null), 3000)
      }
    })
  }

  const notificationTypes: Array<{
    key: keyof typeof settings
    label: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      key: 'offers',
      label: 'Teklif Bildirimleri',
      description: 'Yeni teklifler ve teklif durumu güncellemeleri',
      icon: <Bell className="h-4 w-4" />,
    },
    {
      key: 'advert_applications',
      label: 'İlan Başvuruları',
      description: 'İlan başvurularınız ve durum güncellemeleri',
      icon: <Mail className="h-4 w-4" />,
    },
    {
      key: 'messages',
      label: 'Mesaj Bildirimleri',
      description: 'Yeni mesajlar ve konuşma güncellemeleri',
      icon: <Mail className="h-4 w-4" />,
    },
    {
      key: 'updates',
      label: 'Platform Güncellemeleri',
      description: 'Özellik güncellemeleri ve önemli duyurular',
      icon: <Bell className="h-4 w-4" />,
    },
    {
      key: 'marketing',
      label: 'Pazarlama İletileri',
      description: 'İpuçları, öneriler ve promosyonlar (isteğe bağlı)',
      icon: <Mail className="h-4 w-4" />,
    },
  ]

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-4 flex w-full items-center justify-between gap-3 transition hover:opacity-80"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-soft-gold/30 bg-soft-gold/10 p-2">
            <Mail className="h-5 w-5 text-soft-gold" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold text-white">E-posta Bildirimleri</h2>
            <p className="mt-1 text-sm text-gray-400">Bildirim tercihlerini yönet</p>
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-400">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <>
          {feedback && (
            <div
              className={`mb-4 rounded-2xl border p-3 text-sm ${
                feedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="mt-6 space-y-3">
        {notificationTypes.map((type) => (
          <div
            key={type.key}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400">
                {type.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{type.label}</p>
                <p className="mt-1 text-xs text-gray-400">{type.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(type.key)}
              disabled={isPending}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-soft-gold focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${
                settings[type.key]
                  ? 'bg-soft-gold'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              role="switch"
              aria-checked={settings[type.key]}
              aria-label={type.label}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings[type.key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

          {isPending && (
            <div className="mt-4 text-center text-xs text-gray-400">Kaydediliyor...</div>
          )}
        </>
      )}
    </section>
  )
}

