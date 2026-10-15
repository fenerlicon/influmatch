'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateEmailNotifications } from '@/app/dashboard/influencer/settings/actions'
import { Card, Switch } from '@/components/ui'

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

type Key = keyof EmailNotificationSettingsProps['initialSettings']

// Anahtarlar lib/email-preferences.ts ile aynı; gönderimde lib/notify.ts bu tercihlere uyar (mobil Ayarlar da aynı alan).
const TYPES: { key: Key; label: string; description: string }[] = [
  { key: 'offers', label: 'Teklifler', description: 'Yeni teklifler, teklif durumu ve iş birliği güncellemeleri' },
  { key: 'advert_applications', label: 'İlan başvuruları', description: 'Başvuru sonuçları ve ilan alarmları' },
  { key: 'messages', label: 'Mesajlar', description: 'Yeni mesajlar, en fazla saatte bir özet' },
  { key: 'updates', label: 'Platform güncellemeleri', description: 'Destek yanıtları ve önemli duyurular' },
  { key: 'marketing', label: 'Pazarlama iletileri', description: 'İpuçları ve öneriler (isteğe bağlı)' },
]

export default function EmailNotificationSettings({ userId, initialSettings }: EmailNotificationSettingsProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [isPending, startTransition] = useTransition()

  // Anahtar hemen değişir; kayıt başarısız olursa eski hale döner
  const handleToggle = (key: Key, value: boolean) => {
    const before = settings
    const next = { ...settings, [key]: value }
    setSettings(next)
    startTransition(async () => {
      const result = await updateEmailNotifications(userId, next)
      if (!result.success) {
        setSettings(before)
        toast.error(result.error || 'Ayarlar kaydedilemedi.')
      }
    })
  }

  return (
    <Card>
      {TYPES.map((type) => (
        <div key={type.key} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-ink">{type.label}</p>
            <p className="text-xs text-ink-faint">{type.description}</p>
          </div>
          <Switch checked={settings[type.key]} onChange={(v) => handleToggle(type.key, v)} disabled={isPending} label={type.label} />
        </div>
      ))}
    </Card>
  )
}
